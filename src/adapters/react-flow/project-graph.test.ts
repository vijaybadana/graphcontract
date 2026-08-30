import { describe, expect, it } from 'vitest';

import {
  canConnectCanvasEndpoints,
  canReconnectCanvasEdge,
  domainEdgeIdsForCanvasEdge,
  evidenceMarkersForGraph,
  isCanvasSystemRelationshipEdge,
  isCanvasEdgeSelected,
  isSubgraphProxyEdge,
  projectGraphToCanvas,
  topologyDerivedLoopEdgeIds,
} from '@/src/adapters/react-flow/project-graph';
import {
  createProposal,
  createDefaultGraphCapabilities,
  humanControlHitlDemoGraph,
  researchIntakeRoutingGraph,
  researchSupervisorGraph,
  sampleGraph,
  validateGraph,
  WorkflowGraph,
} from '@/src/domain';
import {
  dynamicParallelismDemoGraph,
  runtimeFixtureForLoadedDynamicParallelismDemo,
} from '@/src/application/package-three-demo';

function graphWithSubgraph(collapsed = false): WorkflowGraph {
  return {
    schemaVersion: '5',
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
      source: 'classifier',
      target: 'external-system:background-runner',
      reconnectable: false,
      data: { projection: 'system-relationship', relationship: { id: 'notify-external-runner' } },
    });
    expect(domainEdgeIdsForCanvasEdge(relationship)).toEqual([]);
    expect(canReconnectCanvasEdge(relationship)).toBe(false);
    expect(canvas.nodes.find((node) => node.id === 'external-system:background-runner')).toMatchObject({
      type: 'externalSystemTile',
      selectable: false,
      data: { label: 'Background runner' },
    });
    expect(native.source).toBe('collapsed-review');
    expect(relationship.source).toBe('classifier');
    expect(native.data.presentation.provenance).toBe('derived-semantic');
  });

  it('projects routing semantics into reusable edge presentation without storing loop mode', () => {
    const graph = structuredClone(researchIntakeRoutingGraph);
    const canvas = projectGraphToCanvas(graph, null);
    const command = canvas.edges.find((edge) => edge.id === 'clarify-write-brief')!;
    const conditional = canvas.edges.find((edge) => edge.id === 'supervisor-final-report')!;
    const fallback = canvas.edges.find((edge) => edge.id === 'supervisor-human-review')!;
    const loop = canvas.edges.find((edge) => edge.id === 'researcher-continue')!;
    const forwardCycleEdge = canvas.edges.find((edge) => edge.id === 'supervisor-researcher')!;

    expect(topologyDerivedLoopEdgeIds(graph)).toEqual(new Set(['researcher-continue']));
    expect(command).toMatchObject({
      type: 'routing',
      markerEnd: { type: 'arrowclosed' },
      data: { presentation: { mode: 'command', loop: false, invalid: false, frozen: false } },
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
    const proposedEdge = projectGraphToCanvas(researchIntakeRoutingGraph, proposal)
      .edges.find((edge) => edge.id === 'clarify-write-brief')!;

    expect(invalidEdge.data.presentation.invalid).toBe(true);
    expect(frozenEdge.data.presentation).toMatchObject({ frozen: true, invalid: false });
    expect(frozenEdge.reconnectable).toBe(false);
    expect(proposedEdge.data.presentation.proposalState).toBe('updated');
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
    const preview = projectGraphToCanvas(humanControlHitlDemoGraph, proposal);
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
    const proposalCanvas = projectGraphToCanvas(graph, proposal);
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

    const canvas = projectGraphToCanvas(graph, proposal);
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

    const added = projectGraphToCanvas(sampleGraph, addedProposal)
      .nodes.find((node) => node.id === 'new-review-group');
    const updated = projectGraphToCanvas(updatedGraph, updatedProposal)
      .nodes.find((node) => node.id === 'review-group');
    const membership = projectGraphToCanvas(membershipGraph, membershipProposal);

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

    const canvas = projectGraphToCanvas(graph, proposal);
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
      dragHandle: '.subgraph-node-drag-surface, .subgraph-node-boundary-drag-surface',
    });
    expect(child).toMatchObject({
      type: 'contractNode',
      parentId: 'review-group',
      position: { x: 60, y: 120 },
      extent: 'parent',
      expandParent: false,
      zIndex: 1,
      hidden: false,
    });
  });

  it('keeps canonical edges visible with original ids and endpoints while expanded', () => {
    const graph = graphWithSubgraph();
    const canvas = projectGraphToCanvas(graph, null);

    expect(canvas.nodes.filter((node) => node.hidden)).toHaveLength(0);
    expect(canvas.edges.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
      ['enter-review', 'start', 'review'],
      ['review-approve', 'review', 'approve'],
      ['review-approve-duplicate', 'review', 'approve'],
      ['leave-approve', 'approve', 'end'],
    ]);
    expect(canvas.edges.every((edge) => !isSubgraphProxyEdge(edge))).toBe(true);
  });

  it('keeps Research Supervisor boundary endpoints canonical when expanded and proxied when collapsed', () => {
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
      ['research-enter-subgraph', 'research-outer-start', 'research-subgraph-start'],
      ['research-start-supervisor', 'research-subgraph-start', 'research-supervisor-agent'],
      ['research-supervisor-tools', 'research-supervisor-agent', 'research-supervisor-tools'],
      ['research-tools-end', 'research-supervisor-tools', 'research-subgraph-end'],
      ['research-exit-subgraph', 'research-subgraph-end', 'research-outer-end'],
    ]);

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
      { id: 'enter-approve', source: 'start', target: 'approve', mode: 'conditional' },
    ];

    const canvas = projectGraphToCanvas(graph, null);
    const incoming = canvas.edges.find(
      (edge) => edge.source === 'start' && edge.target === 'review-group',
    );

    expect(incoming).toBeDefined();
    expect(domainEdgeIdsForCanvasEdge(incoming!)).toEqual(['enter-review', 'enter-approve']);
    expect(canReconnectCanvasEdge(incoming!)).toBe(false);
    expect(isCanvasEdgeSelected(incoming!, ['enter-approve'])).toBe(true);
    expect(isCanvasEdgeSelected(incoming!, ['subgraph-proxy:start:review-group'])).toBe(false);
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
