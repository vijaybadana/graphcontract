import { describe, expect, it } from 'vitest';

import {
  canConnectCanvasEndpoints,
  canReconnectCanvasEdge,
  domainEdgeIdsForCanvasEdge,
  isCanvasEdgeSelected,
  isSubgraphProxyEdge,
  projectGraphToCanvas,
} from '@/src/adapters/react-flow/project-graph';
import { createProposal, sampleGraph, WorkflowGraph } from '@/src/domain';

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

describe('projectGraphToCanvas', () => {
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
    });
    expect(child).toMatchObject({
      type: 'contractNode',
      parentId: 'review-group',
      position: { x: 60, y: 120 },
      extent: 'parent',
      expandParent: false,
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
