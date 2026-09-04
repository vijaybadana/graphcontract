import { describe, expect, it } from 'vitest';

import {
  canConnectCanvasEndpoints,
  canReconnectCanvasEdge,
  domainEdgeIdsForCanvasEdge,
  evidenceMarkersForGraph,
  isCanvasNativeEdge,
  isCanvasSystemRelationshipEdge,
  isCanvasEdgeSelected,
  isSubgraphProxyEdge,
  projectGraphToCanvas,
  proposalReviewToCanvasProjection,
  topologyDerivedLoopEdgeIds,
} from '@/src/adapters/react-flow/project-graph';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
  canvasEdgeTypes,
  canvasNodeRenderers,
  canvasNodeTypes,
} from '@/src/features/canvas/canvas-render-registry';
import { deriveProposalComparison } from '@/src/application/proposal-comparison';
import type { ScenarioPresentation } from '@/src/features/scenarios/scenario-presentation';
import {
  createProposal,
  createDefaultGraphCapabilities,
  humanControlHitlDemoGraph,
  researchIntakeRoutingGraph,
  researchSupervisorGraph,
  sampleGraph,
  type GraphProposal,
  validateGraph,
  WorkflowGraph,
} from '@/src/domain';
import {
  dynamicParallelismDemoGraph,
  runtimeFixtureForLoadedDynamicParallelismDemo,
} from '@/src/application/package-three-demo';
import { graphLibraryEntries } from '@/src/application/graph-library';

function proposalProjection(graph: WorkflowGraph, proposal: GraphProposal) {
  return proposalReviewToCanvasProjection(deriveProposalComparison(graph, proposal));
}

function graphWithSubgraph(collapsed = false): WorkflowGraph {
  return {
    schemaVersion: '6',
    id: 'subgraph-projection',
    name: 'Subgraph projection',
    status: 'draft',
    updatedAt: '2026-08-29T00:00:00.000Z',
    capabilities: createDefaultGraphCapabilities(),
    subgraphs: [
      {
        id: 'review-group',
        label: 'Review process',
        position: { x: 260, y: 120 },
        dimensions: { width: 680, height: 360 },
        collapsed,
      },
    ],
    relationships: [],
    nodes: [
      { id: 'start', kind: 'start', label: 'Start', position: { x: 40, y: 260 } },
      {
        id: 'review',
        kind: 'step',
        executor: 'ai',
        label: 'Review',
        parentId: 'review-group',
        position: { x: 60, y: 120 },
      },
      {
        id: 'approve',
        kind: 'step',
        executor: 'deterministic',
        label: 'Approve',
        parentId: 'review-group',
        position: { x: 330, y: 120 },
      },
      { id: 'end', kind: 'end', label: 'End', position: { x: 1040, y: 260 } },
    ],
    edges: [
      { id: 'enter-review', source: 'start', target: 'review', mode: 'normal' },
      { id: 'review-approve', source: 'review', target: 'approve', mode: 'normal' },
      { id: 'review-approve-duplicate', source: 'review', target: 'approve', mode: 'conditional' },
      { id: 'leave-approve', source: 'approve', target: 'end', mode: 'normal' },
    ],
  };
}

function graphWithTwoSubgraphs(): WorkflowGraph {
  const graph = graphWithSubgraph();
  graph.subgraphs.push({
    id: 'approval-group',
    label: 'Approval process',
    position: { x: 980, y: 120 },
    dimensions: { width: 680, height: 360 },
    collapsed: false,
  });
  return graph;
}

describe('projectGraphToCanvas', () => {
  it('uses the canonical render registry dimensions, components, and stable handles', () => {
    expect(canvasNodeRenderers.contractNode.dimensions).toEqual({ width: 220, height: 134 });
    expect(canvasNodeRenderers.runtimeInstance.dimensions).toEqual({ width: 188, height: 58 });
    expect(canvasNodeRenderers.contractNode.ports).toEqual({
      input: CANVAS_INPUT_PORT_ID,
      output: CANVAS_OUTPUT_PORT_ID,
    });
    expect(Object.keys(canvasNodeTypes)).toEqual([
      'contractNode',
      'mergeJunction',
      'subgraph',
      'runtimeInstance',
      'externalSystemTile',
      'dynamicWorkerGroup',
    ]);
    expect(Object.keys(canvasEdgeTypes)).toEqual(['routing', 'systemRelationship']);

    const canvas = projectGraphToCanvas(sampleGraph, null);
    for (const edge of canvas.edges.filter(isCanvasNativeEdge)) {
      expect(edge.sourceHandle).toBe(CANVAS_OUTPUT_PORT_ID);
      expect(edge.targetHandle).toBe(CANVAS_INPUT_PORT_ID);
    }
  });

  it('projects distinct inherited and overridden durability scope cues onto subgraphs', () => {
    const graph = graphWithSubgraph();
    graph.capabilities = {
      state: { enabled: true, schema: { fields: ['messages'] }, reducers: [] },
      checkpointer: { enabled: true, durableThread: { required: false } },
      store: { available: false },
      runtimeMode: { mode: 'text', input: 'text' },
    };
    graph.subgraphs[0].capabilityOverrides = { store: { available: true, namespace: 'preferences' } };

    const subgraph = projectGraphToCanvas(graph, null).nodes.find((node) => node.id === 'review-group');
    expect(subgraph).toMatchObject({
      type: 'subgraph',
      data: {
        durability: {
          state: { source: 'inherited', value: { enabled: true } },
          checkpointer: { source: 'inherited', value: { enabled: true } },
          store: { source: 'overridden', value: { available: true, namespace: 'preferences' } },
        },
      },
    });
  });

  it('keeps one design template and projects validated runtime instances without moving the Merge', () => {
    const fixture = runtimeFixtureForLoadedDynamicParallelismDemo(dynamicParallelismDemoGraph)!;
    const design = projectGraphToCanvas(dynamicParallelismDemoGraph, null);
    const template = design.nodes.find((node) => node.id === 'search-evidence')!;
    const merge = design.nodes.find((node) => node.id === 'merge-evidence')!;

    expect(template).toMatchObject({
      type: 'contractNode',
      data: { sendTemplate: { edgeId: 'parallel-send-search', payloadLabel: 'query' } },
    });
    expect(merge.type).toBe('mergeJunction');
    expect(design.edges.find((edge) => edge.id === 'parallel-send-search')?.label).toBe('Send ×N');

    const runtime = projectGraphToCanvas(dynamicParallelismDemoGraph, null, {
      mode: 'runtime',
      runtimeFixture: fixture,
    });
    const runtimeNodes = runtime.nodes.filter((node) => node.type === 'runtimeInstance');
    const runtimeMerge = runtime.nodes.find((node) => node.id === 'merge-evidence')!;
    const runtimeTemplate = runtime.nodes.find((node) => node.id === 'search-evidence')!;

    expect(runtimeTemplate.hidden).toBe(true);
    expect(runtimeNodes).toHaveLength(3);
    expect(runtimeNodes.every((node) => !node.draggable && !node.connectable && !node.deletable)).toBe(true);
    expect(runtime.edges.filter((edge) => edge.data.projection === 'runtime-instance')).toHaveLength(6);
    expect(runtime.edges.filter((edge) => edge.data.projection === 'runtime-instance').every(
      (edge) => edge.data.domainEdgeIds.length === 0,
    )).toBe(true);
    expect(runtime.edges.find((edge) => edge.id === 'parallel-send-search')).toBeUndefined();
    expect(runtimeNodes.every((node) => node.position.x + 188 < runtimeMerge.position.x)).toBe(true);

    const revised = { ...dynamicParallelismDemoGraph, updatedAt: '2026-08-31T00:00:00.000Z' };
    expect(projectGraphToCanvas(revised, null, { mode: 'runtime', runtimeFixture: fixture }).nodes.some(
      (node) => node.type === 'runtimeInstance',
    )).toBe(false);
  });

  it('projects repository-faithful Supervisor tools spawning a nested Researcher workflow', () => {
    const graph = graphLibraryEntries.find((entry) => entry.id === 'hierarchical-deep-research')!.graph;
    const design = projectGraphToCanvas(graph, null);
    const supervisor = design.nodes.find((node) => node.id === 'research-cell');
    const researcher = design.nodes.find((node) => node.id === 'researcher-workflow');
    const researcherAgent = design.nodes.find((node) => node.id === 'researcher-agent');

    expect(graph.subgraphs).toHaveLength(2);
    expect(graph.subgraphs[0]).toMatchObject({ id: 'research-cell', label: 'Research Supervisor' });
    expect(supervisor).toMatchObject({ type: 'subgraph' });
    expect(supervisor).not.toHaveProperty('parentId');
    expect(researcher).toMatchObject({
      id: 'researcher-workflow',
      type: 'subgraph',
      parentId: 'research-cell',
      position: { x: 250, y: 380 },
      initialWidth: 1180,
      initialHeight: 500,
      draggable: true,
      selectable: true,
      dragHandle: '.subgraph-node-drag-surface',
      hidden: false,
    });
    expect(researcherAgent).toMatchObject({
      parentId: 'researcher-workflow',
      type: 'contractNode',
      position: { x: 260, y: 160 },
      hidden: false,
    });
    expect(design.nodes.some((node) => node.type === 'dynamicWorkerGroup')).toBe(false);
    expect(design.nodes.some((node) => node.id === 'research-merge')).toBe(false);
    expect(design.edges.find((edge) => edge.id === 'enter-research-cell')).toMatchObject({
      source: 'write-brief',
      target: 'research-cell',
      data: {
        edge: { target: 'research-cell-start' },
        projection: 'subgraph-boundary',
      },
    });
    expect(design.edges.find((edge) => edge.id === 'supervisor-call-tools')).toMatchObject({
      source: 'supervisor-agent',
      target: 'supervisor-tools',
    });
    expect(design.edges.find((edge) => edge.id === 'supervisor-continue')).toMatchObject({
      source: 'supervisor-tools',
      target: 'supervisor-agent',
      data: { edge: { loopCap: 2 } },
    });
    expect(design.edges.find((edge) => edge.id === 'supervisor-conduct-research')).toMatchObject({
      source: 'supervisor-tools',
      target: 'researcher-workflow',
      data: {
        projection: 'subgraph-boundary',
        edge: { target: 'researcher-start', label: 'ConductResearch ×N' },
      },
    });
    expect(design.edges.find((edge) => edge.id === 'researcher-return')).toMatchObject({
      source: 'researcher-workflow',
      target: 'supervisor-tools',
      data: {
        projection: 'subgraph-boundary',
        edge: { source: 'researcher-end', loopCap: 2 },
      },
    });

    const researcherCollapsed = structuredClone(graph);
    researcherCollapsed.subgraphs.find((subgraph) => subgraph.id === 'researcher-workflow')!.collapsed = true;
    const researcherCollapsedCanvas = projectGraphToCanvas(researcherCollapsed, null);
    expect(researcherCollapsedCanvas.nodes.find((node) => node.id === 'researcher-workflow')?.hidden).toBe(false);
    expect(researcherCollapsedCanvas.nodes.find((node) => node.id === 'researcher-agent')?.hidden).toBe(true);
    expect(researcherCollapsedCanvas.edges.some(
      (edge) => edge.source === 'researcher-workflow' || edge.target === 'researcher-workflow',
    )).toBe(true);

    const supervisorCollapsed = structuredClone(graph);
    supervisorCollapsed.subgraphs.find((subgraph) => subgraph.id === 'research-cell')!.collapsed = true;
    const supervisorCollapsedCanvas = projectGraphToCanvas(supervisorCollapsed, null);
    expect(supervisorCollapsedCanvas.nodes.find((node) => node.id === 'researcher-workflow')?.hidden).toBe(true);
    expect(supervisorCollapsedCanvas.nodes.find((node) => node.id === 'researcher-agent')?.hidden).toBe(true);
  });

  it('projects evidence and system relationships without turning them into native or collapsed-proxy edges', () => {
    const graph = structuredClone(sampleGraph);
    graph.capabilities.provenance.externalOrchestrationAvailable = true;
    graph.subgraphs = [{
      id: 'collapsed-review',
      label: 'Collapsed review',
      position: { x: 180, y: 80 },
      dimensions: { width: 480, height: 260 },
      collapsed: true,
    }];
    const classifier = graph.nodes.find((node) => node.id === 'classifier')!;
    classifier.parentId = 'collapsed-review';
    classifier.position = { x: 72, y: 88 };
    classifier.provenance = {
      representation: 'runtime-generated',
      evidence: { source: '<script>untrusted</script>', evidenceClass: 'Factory record', confidence: 'high' },
    };
    const route = graph.edges.find((edge) => edge.source === 'classifier')!;
    route.provenance = {
      representation: 'derived-semantic',
      evidence: { source: 'verified behavior', evidenceClass: 'Semantic inference', confidence: 'medium' },
    };
    graph.relationships = [{
      id: 'notify-external-runner',
      kind: 'external-orchestration',
      source: { kind: 'node', nodeId: 'classifier' },
      target: { kind: 'external', externalId: 'background-runner', label: 'Background runner' },
      label: 'Notify background runner',
      provenance: {
        representation: 'external-orchestration',
        evidence: { source: 'runner config', evidenceClass: 'System boundary', confidence: 'high' },
      },
    }];

    const canvas = projectGraphToCanvas(graph, null);
    const relationship = canvas.edges.find(isCanvasSystemRelationshipEdge)!;
    const native = canvas.edges.find((edge) => domainEdgeIdsForCanvasEdge(edge).includes(route.id))!;
    const markers = evidenceMarkersForGraph(graph);

    expect(markers.map((marker) => `${marker.number}:${marker.target}:${marker.id}`)).toEqual([
      `1:edge:${route.id}`,
      '2:node:classifier',
      '3:relationship:notify-external-runner',
    ]);
    expect(relationship).toMatchObject({
      type: 'systemRelationship',
      source: 'collapsed-review',
      target: 'external-system:background-runner',
      reconnectable: false,
      data: {
        projection: 'system-relationship',
        endpointAliases: { source: 'collapsed-review' },
        relationship: {
          id: 'notify-external-runner',
          source: { kind: 'node', nodeId: 'classifier' },
        },
      },
    });
    expect(domainEdgeIdsForCanvasEdge(relationship)).toEqual([]);
    expect(canReconnectCanvasEdge(relationship)).toBe(false);
    expect(canvas.nodes.find((node) => node.id === 'external-system:background-runner')).toMatchObject({
      type: 'externalSystemTile',
      selectable: false,
      data: { label: 'Background runner' },
    });
    expect(native.source).toBe('collapsed-review');
    expect(native.data.presentation.provenance).toBe('derived-semantic');
  });

  it('aliases incoming and outgoing system relationships to a collapsed card and restores canonical endpoints on expand', () => {
    const graph = graphWithSubgraph(true);
    graph.capabilities.provenance.externalOrchestrationAvailable = true;
    graph.relationships = [
      {
        id: 'outgoing-review-notification',
        kind: 'external-orchestration',
        source: { kind: 'node', nodeId: 'review' },
        target: { kind: 'external', externalId: 'notifier', label: 'Notifier' },
        provenance: { representation: 'external-orchestration' },
      },
      {
        id: 'incoming-review-signal',
        kind: 'external-orchestration',
        source: { kind: 'external', externalId: 'signal', label: 'Signal' },
        target: { kind: 'node', nodeId: 'approve' },
        provenance: { representation: 'external-orchestration' },
      },
    ];
    const before = structuredClone(graph);

    const collapsed = projectGraphToCanvas(graph, null);
    const outgoing = collapsed.edges.find(
      (edge) =>
        isCanvasSystemRelationshipEdge(edge) &&
        edge.data.relationship.id === 'outgoing-review-notification',
    )!;
    const incoming = collapsed.edges.find(
      (edge) =>
        isCanvasSystemRelationshipEdge(edge) &&
        edge.data.relationship.id === 'incoming-review-signal',
    )!;

    expect(outgoing).toMatchObject({
      source: 'review-group',
      target: 'external-system:notifier',
      data: {
        projection: 'system-relationship',
        endpointAliases: { source: 'review-group' },
        relationship: {
          source: { kind: 'node', nodeId: 'review' },
          target: { kind: 'external', externalId: 'notifier' },
        },
      },
    });
    expect(incoming).toMatchObject({
      source: 'external-system:signal',
      target: 'review-group',
      data: {
        projection: 'system-relationship',
        endpointAliases: { target: 'review-group' },
        relationship: {
          source: { kind: 'external', externalId: 'signal' },
          target: { kind: 'node', nodeId: 'approve' },
        },
      },
    });
    expect(domainEdgeIdsForCanvasEdge(outgoing)).toEqual([]);
    expect(domainEdgeIdsForCanvasEdge(incoming)).toEqual([]);
    expect(isSubgraphProxyEdge(outgoing)).toBe(false);
    expect(isSubgraphProxyEdge(incoming)).toBe(false);

    const expandedGraph = structuredClone(graph);
    expandedGraph.subgraphs[0].collapsed = false;
    const expanded = projectGraphToCanvas(expandedGraph, null);
    const expandedOutgoing = expanded.edges.find(
      (edge) =>
        isCanvasSystemRelationshipEdge(edge) &&
        edge.data.relationship.id === 'outgoing-review-notification',
    )!;
    const expandedIncoming = expanded.edges.find(
      (edge) =>
        isCanvasSystemRelationshipEdge(edge) &&
        edge.data.relationship.id === 'incoming-review-signal',
    )!;

    expect(expandedOutgoing).toMatchObject({ source: 'review', target: 'external-system:notifier' });
    expect(expandedIncoming).toMatchObject({ source: 'external-system:signal', target: 'approve' });
    expect(expandedOutgoing.data.endpointAliases).toBeUndefined();
    expect(expandedIncoming.data.endpointAliases).toBeUndefined();
    expect(graph).toEqual(before);
  });

  it('projects exact scenario states and activates a collapsed proxy when any represented edge is active', () => {
    const graph = graphWithSubgraph(true);
    graph.capabilities.provenance.externalOrchestrationAvailable = true;
    graph.nodes.push({
      id: 'unrelated',
      kind: 'step',
      executor: 'deterministic',
      label: 'Unrelated',
      position: { x: 600, y: 520 },
    });
    graph.edges.push({
      id: 'enter-approve',
      source: 'start',
      target: 'approve',
      mode: 'normal',
      label: 'shortcut',
    });
    graph.relationships = [
      {
        id: 'review-notifier',
        kind: 'external-orchestration',
        source: { kind: 'node', nodeId: 'review' },
        target: { kind: 'external', externalId: 'notifier', label: 'Notifier' },
        provenance: { representation: 'external-orchestration' },
      },
      {
        id: 'unrelated-archive',
        kind: 'external-orchestration',
        source: { kind: 'node', nodeId: 'unrelated' },
        target: { kind: 'external', externalId: 'archive', label: 'Archive' },
        provenance: { representation: 'external-orchestration' },
      },
    ];
    const presentation: ScenarioPresentation = {
      scenarioId: 'scenario-review',
      activeNodeIds: new Set(['start', 'review', 'approve', 'end']),
      activeEdgeIds: new Set(['enter-review', 'review-approve', 'leave-approve']),
      activeRelationshipIds: new Set(['review-notifier']),
      activeExternalSystemIds: new Set(['notifier']),
    };
    const before = structuredClone(graph);

    const canvas = projectGraphToCanvas(graph, null, { scenarioPresentation: presentation });
    const entryProxy = canvas.edges.find(
      (edge) => isSubgraphProxyEdge(edge) && edge.source === 'start',
    )!;
    const activeRelationship = canvas.edges.find(
      (edge) => isCanvasSystemRelationshipEdge(edge) && edge.data.relationship.id === 'review-notifier',
    )!;
    const dimmedRelationship = canvas.edges.find(
      (edge) => isCanvasSystemRelationshipEdge(edge) && edge.data.relationship.id === 'unrelated-archive',
    )!;

    expect(domainEdgeIdsForCanvasEdge(entryProxy)).toEqual(['enter-approve', 'enter-review']);
    expect(entryProxy).toMatchObject({
      className: expect.stringContaining('scenario-state--active'),
      data: { presentation: { scenarioState: 'active' } },
    });
    expect(canvas.nodes.find((node) => node.id === 'review-group')).toMatchObject({
      className: 'scenario-state--active',
      data: { scenarioState: 'active' },
    });
    expect(canvas.nodes.find((node) => node.id === 'unrelated')).toMatchObject({
      className: 'scenario-state--dimmed',
      data: { scenarioState: 'dimmed' },
    });
    expect(canvas.nodes.find((node) => node.id === 'external-system:notifier')).toMatchObject({
      className: 'scenario-state--active',
      data: { scenarioState: 'active' },
    });
    expect(activeRelationship).toMatchObject({
      className: 'scenario-state--active',
      data: { scenarioState: 'active' },
    });
    expect(dimmedRelationship).toMatchObject({
      className: 'scenario-state--dimmed',
      data: { scenarioState: 'dimmed' },
    });

    const reversed = projectGraphToCanvas(
      { ...graph, edges: [...graph.edges].reverse() },
      null,
      { scenarioPresentation: presentation },
    );
    expect(reversed.edges.find(
      (edge) => isSubgraphProxyEdge(edge) && edge.source === 'start',
    )?.data.presentation.scenarioState).toBe('active');
    expect(graph).toEqual(before);
  });

  it('keeps Merge evidence and proposal relationship records in the projection layer', () => {
    const graph = structuredClone(sampleGraph);
    graph.capabilities.provenance.externalOrchestrationAvailable = true;
    graph.nodes.push({
      id: 'merge-contract',
      kind: 'merge',
      label: 'Merge contract',
      position: { x: 680, y: 360 },
      merge: {
        reducer: { name: 'append', aggregateState: 'evidence' },
        completion: { mode: 'all' },
        continuation: { mode: 'once' },
        waitingForDynamicInputs: true,
      },
      provenance: {
        representation: 'derived-semantic',
        evidence: { source: 'merge contract', evidenceClass: 'Semantic inference', confidence: 'high' },
      },
    });
    graph.relationships = [
      {
        id: 'update-runner',
        kind: 'spawned-run',
        source: { kind: 'node', nodeId: 'classifier' },
        target: { kind: 'external', externalId: 'runner', label: 'Runner' },
        label: 'Accepted runner',
        provenance: { representation: 'declared' },
      },
      {
        id: 'remove-runner',
        kind: 'external-orchestration',
        source: { kind: 'node', nodeId: 'billing' },
        target: { kind: 'external', externalId: 'archive', label: 'Archive' },
        label: 'Accepted archive',
        provenance: { representation: 'external-orchestration' },
      },
    ];
    const proposal = createProposal(graph, {
      rationale: 'Review system-boundary changes.',
      operations: [
        {
          type: 'update_relationship',
          relationshipId: 'update-runner',
          patch: { label: 'Candidate runner' },
        },
        { type: 'remove_relationship', relationshipId: 'remove-runner' },
        {
          type: 'add_relationship',
          relationship: {
            id: 'added-runner',
            kind: 'external-orchestration',
            source: { kind: 'node', nodeId: 'classifier' },
            target: { kind: 'external', externalId: 'queue', label: 'Queue' },
            label: 'Candidate queue',
            provenance: { representation: 'external-orchestration' },
          },
        },
      ],
    }).proposal!;

    const projection = proposalProjection(graph, proposal);
    const canvas = projectGraphToCanvas(graph, projection);
    const relationship = (id: string) =>
      canvas.edges.find(
        (edge) => isCanvasSystemRelationshipEdge(edge) && edge.data.relationship.id === id,
      );
    const merge = canvas.nodes.find((node) => node.id === 'merge-contract');

    expect(evidenceMarkersForGraph(graph).some((marker) => marker.target === 'node' && marker.id === 'merge-contract')).toBe(true);
    expect(merge).toMatchObject({
      type: 'mergeJunction',
      data: { provenance: { representation: 'derived-semantic' } },
    });
    expect(relationship('added-runner')).toMatchObject({
      data: { proposalState: 'added', relationship: { label: 'Candidate queue' } },
    });
    expect(relationship('update-runner')).toMatchObject({
      data: { proposalState: 'updated', relationship: { label: 'Candidate runner' } },
    });
    expect(relationship('remove-runner')).toMatchObject({
      selectable: true,
      reconnectable: false,
      data: {
        proposalState: 'removed',
        readOnly: true,
        relationship: { label: 'Accepted archive' },
      },
    });
    expect(graph.relationships.map((entry) => entry.label)).toEqual(['Accepted runner', 'Accepted archive']);

    const repeat = projectGraphToCanvas(graph, projection);
    expect(repeat.nodes.filter((node) => node.type === 'externalSystemTile').map((node) => ({ id: node.id, position: node.position }))).toEqual(
      canvas.nodes.filter((node) => node.type === 'externalSystemTile').map((node) => ({ id: node.id, position: node.position })),
    );
  });

  it('projects routing semantics into reusable edge presentation without storing loop mode', () => {
    const graph = structuredClone(researchIntakeRoutingGraph);
    graph.edges.find((edge) => edge.id === 'clarify-write-brief')!.provenance = {
      representation: 'runtime-generated',
      evidence: {
        source: 'Focused projection fixture',
        evidenceClass: 'observed-route',
        confidence: 'high',
      },
    };
    const canvas = projectGraphToCanvas(graph, null);
    const command = canvas.edges.find((edge) => edge.id === 'clarify-write-brief')!;
    const conditional = canvas.edges.find((edge) => edge.id === 'supervisor-final-report')!;
    const fallback = canvas.edges.find((edge) => edge.id === 'supervisor-human-review')!;
    const loop = canvas.edges.find((edge) => edge.id === 'researcher-continue')!;
    const forwardCycleEdge = canvas.edges.find((edge) => edge.id === 'supervisor-researcher')!;

    expect(topologyDerivedLoopEdgeIds(graph)).toEqual(new Set(['researcher-continue']));
    expect(command).toMatchObject({
      type: 'routing',
      markerEnd: { type: 'arrowclosed', color: 'var(--gc-route-command)' },
      style: {
        stroke: 'var(--gc-route-command)',
        strokeDasharray: '7 5',
      },
      data: {
        presentation: {
          mode: 'command',
          loop: false,
          invalid: false,
          frozen: false,
          provenance: 'runtime-generated',
        },
      },
    });
    expect(conditional.data.presentation.mode).toBe('conditional');
    expect(fallback.data.presentation.mode).toBe('fallback');
    expect(loop.data.presentation).toMatchObject({ mode: 'normal', loop: true });
    expect(forwardCycleEdge.data.presentation.loop).toBe(false);

    const loopTargetPositionedLater = structuredClone(graph);
    loopTargetPositionedLater.nodes.find((node) => node.id === 'research-supervisor')!.position = {
      x: 1100,
      y: 780,
    };
    const layoutIndependentLoop = projectGraphToCanvas(loopTargetPositionedLater, null)
      .edges.find((edge) => edge.id === 'researcher-continue')!;

    expect(topologyDerivedLoopEdgeIds(loopTargetPositionedLater)).toEqual(
      new Set(['researcher-continue']),
    );
    expect(layoutIndependentLoop.data.presentation.loop).toBe(true);
  });

  it('keeps invalid, frozen, and proposal-diff states observable without changing reconnect rules', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = '  ';
    const invalidEdge = projectGraphToCanvas(invalid, null)
      .edges.find((edge) => edge.id === 'clarify-write-brief')!;
    const frozenEdge = projectGraphToCanvas(
      { ...researchIntakeRoutingGraph, status: 'frozen' },
      null,
    ).edges.find((edge) => edge.id === 'clarify-write-brief')!;
    const proposal = createProposal(researchIntakeRoutingGraph, {
      rationale: 'Update the command label for review.',
      operations: [
        { type: 'update_edge', edgeId: 'clarify-write-brief', patch: { label: 'approved' } },
      ],
    }).proposal!;
    const proposedEdge = projectGraphToCanvas(
      researchIntakeRoutingGraph,
      proposalProjection(researchIntakeRoutingGraph, proposal),
    )
      .edges.find((edge) => edge.id === 'clarify-write-brief')!;

    expect(invalidEdge.data.presentation.invalid).toBe(true);
    expect(frozenEdge.data.presentation).toMatchObject({ frozen: true, invalid: false });
    expect(frozenEdge.reconnectable).toBe(false);
    expect(proposedEdge.data.presentation.proposalState).toBe('updated');
  });

  it('projects net-zero progressive operations as unchanged final review truth', () => {
    const graph = structuredClone(sampleGraph);
    const acceptedLabel = graph.nodes.find((node) => node.id === 'diagnostic')!.label;
    const proposal = createProposal(graph, {
      rationale: 'Temporarily rename a step and then restore the accepted label.',
      operations: [
        { type: 'update_node', nodeId: 'diagnostic', patch: { label: 'Temporary label' } },
        { type: 'update_node', nodeId: 'diagnostic', patch: { label: acceptedLabel } },
      ],
    }).proposal!;
    // Stored operation summaries are intentionally not final review truth.
    proposal.diff.updatedNodeIds = ['diagnostic'];

    const review = deriveProposalComparison(graph, proposal);
    const projection = proposalReviewToCanvasProjection(review);
    const canvas = projectGraphToCanvas(graph, projection);
    const diagnostic = canvas.nodes.find((node) => node.id === 'diagnostic');

    expect(review.kind).toBe('comparable');
    expect(projection).toMatchObject({
      kind: 'comparable',
      states: { nodes: { diagnostic: 'unchanged' } },
    });
    expect(diagnostic?.data).toMatchObject({ label: acceptedLabel });
    expect(diagnostic?.data.proposalState).toBeUndefined();
  });

  it('projects a stale review from accepted-only state without synthesizing a candidate', () => {
    const base = structuredClone(sampleGraph);
    const proposal = createProposal(base, {
      rationale: 'This candidate must not be replayed against a newer accepted graph.',
      operations: [
        { type: 'update_node', nodeId: 'diagnostic', patch: { label: 'Synthetic stale label' } },
      ],
    }).proposal!;
    const accepted = structuredClone(base);
    accepted.updatedAt = '2099-01-01T00:00:00.000Z';
    accepted.nodes.find((node) => node.id === 'diagnostic')!.label = 'Accepted newer label';

    const projection = proposalReviewToCanvasProjection(
      deriveProposalComparison(accepted, proposal),
    );
    const canvas = projectGraphToCanvas(base, projection);
    const diagnostic = canvas.nodes.find((node) => node.id === 'diagnostic');

    expect(projection).toMatchObject({ kind: 'stale' });
    expect(projection).not.toHaveProperty('candidate');
    expect(diagnostic?.data).toMatchObject({ label: 'Accepted newer label' });
    expect(diagnostic?.data.proposalState).toBeUndefined();
    expect(JSON.stringify(canvas)).not.toContain('Synthetic stale label');
    expect(canvas.edges.find((edge) => edge.data?.projection === 'domain')?.reconnectable)
      .toBe(false);
  });

  it('keeps v3 HITL outcomes and sensitive policy in a read-only proposal preview', () => {
    const proposal = createProposal(humanControlHitlDemoGraph, {
      rationale: 'Clarify the authorization without applying the candidate.',
      operations: [
        {
          type: 'update_node',
          nodeId: 'deploy-change',
          patch: {
            sensitive: {
              target: 'Production deployment',
              authorization: 'Production release manager',
              approvalRequired: true,
              idempotency: 'Deployment request ID',
            },
          },
        },
      ],
    }).proposal!;
    const preview = projectGraphToCanvas(
      humanControlHitlDemoGraph,
      proposalProjection(humanControlHitlDemoGraph, proposal),
    );
    const deploy = preview.nodes.find((node) => node.id === 'deploy-change');

    expect(deploy?.data).toMatchObject({
      proposalState: 'updated',
      hitl: {
        response: {
          allowedOutcomes: [
            { id: 'approve', resumeNodeId: 'change-completed' },
            { id: 'request-changes', resumeNodeId: 'revise-change-plan' },
            { id: 'reject', resumeNodeId: 'change-cancelled' },
          ],
        },
      },
      sensitive: { authorization: 'Production release manager' },
    });
    expect(humanControlHitlDemoGraph.nodes.find((node) => node.id === 'deploy-change')).toMatchObject({
      sensitive: { authorization: 'Release manager' },
    });
  });

  it('projects every edge from a source-scoped routing issue and every invalid connection', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'supervisor-researcher')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'brief-supervisor')!.mode = 'conditional';
    invalid.edges.find((edge) => edge.id === 'researcher-continue')!.mode = 'fallback';
    invalid.edges.push(
      { id: 'final-report-extra-normal', source: 'final-report', target: 'awaiting-user-reply', mode: 'normal' },
      { id: 'researcher-extra-fallback', source: 'researcher', target: 'final-report', mode: 'fallback' },
      { id: 'clarify-self', source: 'clarify-request', target: 'clarify-request', mode: 'command', label: 'retry' },
      { id: 'research-intake-start-clarify-duplicate', source: 'research-intake-start', target: 'clarify-request', mode: 'normal' },
      { id: 'clarify-start', source: 'clarify-request', target: 'research-intake-start', mode: 'command', label: 'restart' },
    );

    const sourceScopedIssueCodes = new Set([
      'MULTIPLE_NORMAL_EDGES',
      'CONDITIONAL_EDGE_COUNT',
      'MULTIPLE_FALLBACKS',
      'FALLBACK_WITHOUT_CONDITIONS',
      'CONDITIONAL_LABEL_REQUIRED',
      'DUPLICATE_CONDITIONAL_LABEL',
      'COMMAND_LABEL_REQUIRED',
    ]);
    const affectedSources = new Set(
      validateGraph(invalid)
        .filter((issue) => sourceScopedIssueCodes.has(issue.code))
        .map((issue) => issue.path?.replace('nodes.', '')),
    );
    const canvas = projectGraphToCanvas(invalid, null);

    expect(affectedSources).toEqual(
      new Set(['research-intake-start', 'final-report', 'write-research-brief', 'researcher', 'research-supervisor', 'clarify-request']),
    );
    for (const source of affectedSources) {
      expect(canvas.edges.filter((edge) => edge.data.edge.source === source)).not.toHaveLength(0);
      expect(canvas.edges.filter((edge) => edge.data.edge.source === source).every(
        (edge) => edge.data.presentation.invalid,
      )).toBe(true);
    }
    expect(canvas.edges.find((edge) => edge.id === 'clarify-self')?.data.presentation.invalid).toBe(true);
    expect(canvas.edges.find((edge) => edge.id === 'research-intake-start-clarify')?.data.presentation.invalid).toBe(true);
    expect(canvas.edges.find((edge) => edge.id === 'research-intake-start-clarify-duplicate')?.data.presentation.invalid).toBe(true);
    expect(canvas.edges.find((edge) => edge.id === 'clarify-start')?.data.presentation.invalid).toBe(true);
  });

  it('keeps node dimensions stable while previewing proposal badges', () => {
    const graph = structuredClone(sampleGraph);
    const proposal = createProposal(graph, {
      operations: [
        { type: 'update_node', nodeId: 'diagnostic', patch: { label: 'Technical Review' } },
      ],
      rationale: 'Preview a node update.',
    }).proposal!;

    const acceptedCanvas = projectGraphToCanvas(graph, null);
    const proposalCanvas = projectGraphToCanvas(graph, proposalProjection(graph, proposal));
    const acceptedNode = acceptedCanvas.nodes.find((node) => node.id === 'diagnostic');
    const proposedNode = proposalCanvas.nodes.find((node) => node.id === 'diagnostic');

    expect(proposedNode?.type).toBe('contractNode');
    expect(acceptedNode?.type).toBe('contractNode');
    if (proposedNode?.type !== 'contractNode' || acceptedNode?.type !== 'contractNode') {
      throw new Error('Expected contract nodes.');
    }
    expect(proposedNode.data.proposalState).toBe('updated');
    expect(proposedNode.initialWidth).toBe(acceptedNode.initialWidth);
    expect(proposedNode.initialHeight).toBe(acceptedNode.initialHeight);
  });

  it('projects the fully applied candidate when a proposal reparents a node into a new subgraph', () => {
    const graph = structuredClone(sampleGraph);
    const proposal = createProposal(graph, {
      rationale: 'Preview a review container around billing.',
      operations: [
        {
          type: 'add_subgraph',
          subgraph: {
            id: 'billing-review',
            label: 'Billing review',
            position: { x: 300, y: 100 },
            dimensions: { width: 640, height: 360 },
            collapsed: false,
          },
        },
        {
          type: 'assign_nodes_to_subgraph',
          subgraphId: 'billing-review',
          nodeIds: ['billing'],
        },
      ],
    }).proposal!;

    const canvas = projectGraphToCanvas(graph, proposalProjection(graph, proposal));
    const billing = canvas.nodes.find((node) => node.id === 'billing');

    expect(canvas.nodes.find((node) => node.id === 'billing-review')).toMatchObject({
      position: { x: 300, y: 100 },
      type: 'subgraph',
    });
    expect(billing).toMatchObject({
      parentId: 'billing-review',
      position: { x: 180, y: -40 },
      extent: 'parent',
    });
    expect(graph.nodes.find((node) => node.id === 'billing')?.parentId).toBeUndefined();
  });

  it('marks added, updated, and membership-affected candidate containers for proposal review', () => {
    const addedProposal = createProposal(sampleGraph, {
      rationale: 'Preview a new review container.',
      operations: [
        {
          type: 'add_subgraph',
          subgraph: {
            id: 'new-review-group',
            label: 'New review group',
            position: { x: 300, y: 100 },
            dimensions: { width: 640, height: 360 },
            collapsed: false,
          },
        },
      ],
    }).proposal!;
    const updatedGraph = graphWithSubgraph();
    const updatedProposal = createProposal(updatedGraph, {
      rationale: 'Rename the review container.',
      operations: [
        {
          type: 'update_subgraph',
          subgraphId: 'review-group',
          patch: { label: 'Updated review process' },
        },
      ],
    }).proposal!;
    const membershipGraph = graphWithTwoSubgraphs();
    const membershipProposal = createProposal(membershipGraph, {
      rationale: 'Move review into approval.',
      operations: [
        {
          type: 'assign_nodes_to_subgraph',
          subgraphId: 'approval-group',
          nodeIds: ['review'],
        },
      ],
    }).proposal!;

    const added = projectGraphToCanvas(sampleGraph, proposalProjection(sampleGraph, addedProposal))
      .nodes.find((node) => node.id === 'new-review-group');
    const updated = projectGraphToCanvas(
      updatedGraph,
      proposalProjection(updatedGraph, updatedProposal),
    )
      .nodes.find((node) => node.id === 'review-group');
    const membership = projectGraphToCanvas(
      membershipGraph,
      proposalProjection(membershipGraph, membershipProposal),
    );

    expect(added).toMatchObject({ type: 'subgraph', data: { proposalState: 'added' } });
    expect(updated).toMatchObject({
      type: 'subgraph',
      data: { label: 'Updated review process', proposalState: 'updated' },
    });
    expect(membership.nodes.find((node) => node.id === 'review-group')).toMatchObject({
      data: { proposalState: 'updated' },
    });
    expect(membership.nodes.find((node) => node.id === 'approval-group')).toMatchObject({
      data: { proposalState: 'updated' },
    });
  });

  it('shows a dissolved container as a non-interactive ghost without using it for candidate edges', () => {
    const graph = graphWithSubgraph();
    const proposal = createProposal(graph, {
      rationale: 'Dissolve the review container.',
      operations: [{ type: 'dissolve_subgraph', subgraphId: 'review-group' }],
    }).proposal!;

    const canvas = projectGraphToCanvas(graph, proposalProjection(graph, proposal));
    const ghost = canvas.nodes.find((node) => node.id === 'review-group');
    const review = canvas.nodes.find((node) => node.id === 'review');

    expect(ghost).toMatchObject({
      type: 'subgraph',
      selectable: false,
      draggable: false,
      focusable: false,
      data: { proposalState: 'removed' },
    });
    expect(review).not.toHaveProperty('parentId');
    expect(review).toMatchObject({ position: { x: 320, y: 240 } });
    expect(canvas.edges.some((edge) => edge.source === 'review-group' || edge.target === 'review-group')).toBe(false);
    expect(canvas.edges.some(isSubgraphProxyEdge)).toBe(false);
  });

  it('emits a subgraph parent before relative children in expanded projection', () => {
    const canvas = projectGraphToCanvas(graphWithSubgraph(), null);
    const parentIndex = canvas.nodes.findIndex((node) => node.id === 'review-group');
    const childIndex = canvas.nodes.findIndex((node) => node.id === 'review');
    const parent = canvas.nodes[parentIndex];
    const child = canvas.nodes[childIndex];

    expect(parentIndex).toBeLessThan(childIndex);
    expect(parent).toMatchObject({
      type: 'subgraph',
      position: { x: 260, y: 120 },
      initialWidth: 680,
      initialHeight: 360,
      selectable: true,
      draggable: true,
      focusable: true,
      zIndex: 0,
      dragHandle: '.subgraph-node-drag-surface',
    });
    expect(child).toMatchObject({
      type: 'contractNode',
      parentId: 'review-group',
      position: { x: 60, y: 120 },
      extent: 'parent',
      expandParent: false,
      zIndex: 3,
      hidden: false,
    });
  });

  it('keeps canonical edge ids while projecting expanded cross-boundary endpoints to the frame', () => {
    const graph = graphWithSubgraph();
    const canvas = projectGraphToCanvas(graph, null);

    expect(canvas.nodes.filter((node) => node.hidden)).toHaveLength(0);
    expect(canvas.edges.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
      ['enter-review', 'start', 'review-group'],
      ['review-approve', 'review', 'approve'],
      ['review-approve-duplicate', 'review', 'approve'],
      ['leave-approve', 'review-group', 'end'],
    ]);
    expect(canvas.edges.every((edge) => !isSubgraphProxyEdge(edge))).toBe(true);
    expect(canvas.edges.find((edge) => edge.id === 'enter-review')).toMatchObject({
      reconnectable: false,
      data: {
        edge: { source: 'start', target: 'review' },
        endpointAliases: { target: 'review-group' },
        projection: 'subgraph-boundary',
      },
    });
    expect(canvas.edges.find((edge) => edge.id === 'review-approve')).toMatchObject({
      data: { projection: 'domain' },
    });
  });

  it('renders Research Supervisor entry and exit on its expanded frame without rewiring canonical endpoints', () => {
    const expanded = projectGraphToCanvas(researchSupervisorGraph, null);

    expect(expanded.nodes.find((node) => node.id === 'research-subgraph-start')).toMatchObject({
      parentId: 'research-supervisor',
      hidden: false,
    });
    expect(expanded.nodes.find((node) => node.id === 'research-subgraph-end')).toMatchObject({
      parentId: 'research-supervisor',
      hidden: false,
    });
    expect(expanded.edges.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
      ['research-enter-subgraph', 'research-outer-start', 'research-supervisor'],
      ['research-start-supervisor', 'research-subgraph-start', 'research-supervisor-agent'],
      ['research-supervisor-tools', 'research-supervisor-agent', 'research-supervisor-tools'],
      ['research-tools-end', 'research-supervisor-tools', 'research-subgraph-end'],
      ['research-exit-subgraph', 'research-supervisor', 'research-outer-end'],
    ]);
    expect(expanded.edges.find((edge) => edge.id === 'research-enter-subgraph')).toMatchObject({
      data: {
        edge: { source: 'research-outer-start', target: 'research-subgraph-start' },
        endpointAliases: { target: 'research-supervisor' },
        projection: 'subgraph-boundary',
      },
    });

    const collapsedGraph = structuredClone(researchSupervisorGraph);
    collapsedGraph.subgraphs[0].collapsed = true;
    const collapsed = projectGraphToCanvas(collapsedGraph, null);
    const proxies = collapsed.edges.filter(isSubgraphProxyEdge);

    expect(proxies.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
      ['subgraph-proxy:research-outer-start:research-supervisor', 'research-outer-start', 'research-supervisor'],
      ['subgraph-proxy:research-supervisor:research-outer-end', 'research-supervisor', 'research-outer-end'],
    ]);
    expect(domainEdgeIdsForCanvasEdge(proxies[0])).toEqual(['research-enter-subgraph']);
    expect(domainEdgeIdsForCanvasEdge(proxies[1])).toEqual(['research-exit-subgraph']);
  });

  it('marks visual containment without changing canonical membership', () => {
    const graph = graphWithSubgraph();
    graph.nodes.push({
      id: 'outside-member',
      kind: 'step',
      executor: 'tool',
      label: 'Outside member',
      position: { x: 420, y: 220 },
    });

    const visuallyContained = projectGraphToCanvas(graph, null)
      .nodes.find((node) => node.id === 'outside-member');
    const assignedGraph = structuredClone(graph);
    const assignedNode = assignedGraph.nodes.find((node) => node.id === 'outside-member')!;
    assignedNode.parentId = 'review-group';
    assignedNode.position = { x: 160, y: 100 };
    const canonicallyContained = projectGraphToCanvas(assignedGraph, null)
      .nodes.find((node) => node.id === 'outside-member');

    expect(visuallyContained).toMatchObject({
      type: 'contractNode',
      data: { outsideSubgraph: true },
    });
    expect(visuallyContained).not.toHaveProperty('parentId');
    expect(canonicallyContained).toMatchObject({
      parentId: 'review-group',
      data: { outsideSubgraph: false },
    });
    expect(graph.nodes.find((node) => node.id === 'outside-member')?.parentId).toBeUndefined();
  });

  it('hides collapsed members and internal edges while projecting deterministic proxies', () => {
    const graph = graphWithSubgraph(true);
    const beforeProjection = structuredClone(graph);
    const canvas = projectGraphToCanvas(graph, null);
    const proxies = canvas.edges.filter(isSubgraphProxyEdge);

    expect(canvas.nodes.find((node) => node.id === 'review')?.hidden).toBe(true);
    expect(canvas.nodes.find((node) => node.id === 'approve')?.hidden).toBe(true);
    expect(canvas.nodes.find((node) => node.id === 'review-group')?.zIndex).toBe(10);
    expect(canvas.edges.some((edge) => edge.id === 'review-approve')).toBe(false);
    expect(proxies.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
      ['subgraph-proxy:start:review-group', 'start', 'review-group'],
      ['subgraph-proxy:review-group:end', 'review-group', 'end'],
    ]);
    expect(domainEdgeIdsForCanvasEdge(proxies[1])).toEqual(['leave-approve']);
    expect(proxies.every((edge) => edge.reconnectable === false)).toBe(true);
    expect(graph).toEqual(beforeProjection);
  });

  it('deduplicates identical collapsed endpoints while preserving every domain edge selection id', () => {
    const graph = graphWithSubgraph(true);
    graph.edges = [
      ...graph.edges,
      { id: 'enter-approve', source: 'start', target: 'approve', mode: 'normal' },
    ];

    const canvas = projectGraphToCanvas(graph, null);
    const incoming = canvas.edges.find(
      (edge) => edge.source === 'start' && edge.target === 'review-group',
    );

    expect(incoming).toBeDefined();
    expect(domainEdgeIdsForCanvasEdge(incoming!)).toEqual(['enter-approve', 'enter-review']);
    expect(canReconnectCanvasEdge(incoming!)).toBe(false);
    expect(isCanvasEdgeSelected(incoming!, ['enter-approve'])).toBe(true);
    expect(isCanvasEdgeSelected(incoming!, ['subgraph-proxy:start:review-group'])).toBe(false);

    const reversed = projectGraphToCanvas(
      { ...graph, edges: [...graph.edges].reverse() },
      null,
    ).edges.find(
      (edge) => edge.source === 'start' && edge.target === 'review-group',
    );
    expect(reversed).toEqual(incoming);
  });

  it('projects distinct collapsed route semantics deterministically in either insertion order', () => {
    const graph = graphWithSubgraph(true);
    graph.status = 'frozen';
    const enterReview = graph.edges.find((edge) => edge.id === 'enter-review')!;
    enterReview.mode = 'command';
    enterReview.label = 'review';
    enterReview.provenance = { representation: 'runtime-generated' };
    graph.edges.push({
      id: 'enter-approve',
      source: 'start',
      target: 'approve',
      mode: 'fallback',
      provenance: { representation: 'external-orchestration' },
    });

    const projectIncoming = (candidate: WorkflowGraph) =>
      projectGraphToCanvas(candidate, null).edges
        .filter((edge) => isSubgraphProxyEdge(edge) && edge.source === 'start')
        .map((edge) => ({
          id: edge.id,
          domainEdgeIds: domainEdgeIdsForCanvasEdge(edge),
          presentation: edge.data.presentation,
          style: edge.style,
          markerEnd: edge.markerEnd,
        }));
    const projected = projectIncoming(graph);
    const reversed = projectIncoming({ ...graph, edges: [...graph.edges].reverse() });

    expect(reversed).toEqual(projected);
    expect(projected).toEqual([
      expect.objectContaining({
        id: 'subgraph-proxy:start:review-group:fallback%3Aroute%3Aexternal-orchestration',
        domainEdgeIds: ['enter-approve'],
        presentation: expect.objectContaining({
          mode: 'fallback',
          provenance: 'external-orchestration',
          frozen: true,
        }),
        style: expect.objectContaining({
          stroke: 'var(--gc-route-fallback)',
          strokeDasharray: '6 5',
        }),
        markerEnd: { type: 'arrowclosed', color: 'var(--gc-route-fallback)' },
      }),
      expect.objectContaining({
        id: 'subgraph-proxy:start:review-group:command%3Aroute%3Aruntime-generated',
        domainEdgeIds: ['enter-review'],
        presentation: expect.objectContaining({
          mode: 'command',
          provenance: 'runtime-generated',
          frozen: true,
        }),
        style: expect.objectContaining({
          stroke: 'var(--gc-route-command)',
          strokeDasharray: '7 5',
        }),
        markerEnd: { type: 'arrowclosed', color: 'var(--gc-route-command)' },
      }),
    ]);
  });

  it('retains per-domain-edge review states and exposes mixed state on a collapsed proxy', () => {
    const graph = graphWithSubgraph(true);
    graph.edges.push({
      id: 'enter-approve',
      source: 'start',
      target: 'approve',
      mode: 'normal',
      label: 'approve',
    });
    const proposal = createProposal(graph, {
      rationale: 'Review different changes represented by one collapsed boundary.',
      operations: [
        { type: 'update_edge', edgeId: 'enter-review', patch: { label: 'review' } },
        { type: 'remove_edge', edgeId: 'enter-approve' },
      ],
    }).proposal!;

    const incoming = projectGraphToCanvas(
      graph,
      proposalProjection(graph, proposal),
    ).edges.find(
      (edge) => isSubgraphProxyEdge(edge) && edge.source === 'start',
    )!;

    expect(domainEdgeIdsForCanvasEdge(incoming)).toEqual(['enter-approve', 'enter-review']);
    expect(incoming.data.review).toEqual({
      aggregate: 'mixed',
      byDomainEdgeId: {
        'enter-approve': 'removed',
        'enter-review': 'updated',
      },
    });
    expect(incoming.data.presentation.proposalState).toBe('mixed');
  });

  it('aggregates changed descendant review state onto a collapsed subgraph without mutating the graph', () => {
    const graph = graphWithSubgraph(true);
    const before = structuredClone(graph);
    const proposal = createProposal(graph, {
      rationale: 'Rename a child while its review container is collapsed.',
      operations: [
        { type: 'update_node', nodeId: 'review', patch: { label: 'Updated review' } },
      ],
    }).proposal!;

    const collapsed = projectGraphToCanvas(graph, proposalProjection(graph, proposal));
    const container = collapsed.nodes.find((node) => node.id === 'review-group');

    expect(container).toMatchObject({
      type: 'subgraph',
      data: {
        proposalState: 'updated',
        descendantReviewState: 'updated',
      },
    });
    expect(collapsed.nodes.find((node) => node.id === 'review')).toMatchObject({
      hidden: true,
      data: { proposalState: 'updated' },
    });
    expect(graph).toEqual(before);
  });

  it('restores canonical edge ids and allows only visible graph-node endpoints after expansion', () => {
    const collapsed = projectGraphToCanvas(graphWithSubgraph(true), null);
    const expanded = projectGraphToCanvas(graphWithSubgraph(false), null);

    expect(expanded.edges.map((edge) => edge.id)).toEqual([
      'enter-review',
      'review-approve',
      'review-approve-duplicate',
      'leave-approve',
    ]);
    expect(canConnectCanvasEndpoints(collapsed.nodes, 'start', 'review-group')).toBe(false);
    expect(canConnectCanvasEndpoints(collapsed.nodes, 'start', 'review')).toBe(false);
    expect(canConnectCanvasEndpoints(expanded.nodes, 'start', 'review')).toBe(true);
  });
});
