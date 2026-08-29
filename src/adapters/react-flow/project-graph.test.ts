import { describe, expect, it } from 'vitest';

import {
  canConnectCanvasEndpoints,
  canReconnectCanvasEdge,
  domainEdgeIdsForCanvasEdge,
  isCanvasEdgeSelected,
  isSubgraphProxyEdge,
  projectGraphToCanvas,
  topologyDerivedLoopEdgeIds,
} from '@/src/adapters/react-flow/project-graph';
import { createProposal, researchIntakeRoutingGraph, sampleGraph, WorkflowGraph } from '@/src/domain';

function graphWithSubgraph(collapsed = false): WorkflowGraph {
  return {
    schemaVersion: '1',
    id: 'subgraph-projection',
    name: 'Subgraph projection',
    status: 'draft',
    updatedAt: '2026-08-29T00:00:00.000Z',
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
        kind: 'agent',
        label: 'Review',
        parentId: 'review-group',
        position: { x: 60, y: 120 },
      },
      {
        id: 'approve',
        kind: 'action',
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

  it('marks visual containment without changing canonical membership', () => {
    const graph = graphWithSubgraph();
    graph.nodes.push({
      id: 'outside-member',
      kind: 'tool',
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
