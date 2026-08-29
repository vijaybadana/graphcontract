import { Edge, MarkerType } from '@xyflow/react';

import { applyGraphOperations, GraphOperation, GraphProposal, WorkflowGraph } from '@/src/domain';
import { ContractFlowNode } from '@/src/features/canvas/contract-node';

export function projectGraphToCanvas(
  graph: WorkflowGraph,
  proposal: GraphProposal | null,
): { nodes: ContractFlowNode[]; edges: Edge[] } {
  const visibleProposal =
    proposal?.status === 'pending' || proposal?.status === 'invalid' ? proposal : null;
  const preview = visibleProposal
    ? applyGraphOperations(graph, visibleProposal.operations).graph
    : graph;

  const baseNodeIds = new Set(graph.nodes.map((node) => node.id));
  const sourceNodes = [...graph.nodes];
  for (const node of preview.nodes) {
    if (!baseNodeIds.has(node.id)) sourceNodes.push(node);
  }
  const nodeUpdates = new Map(
    (visibleProposal?.operations ?? [])
      .filter(
        (operation): operation is Extract<GraphOperation, { type: 'update_node' }> =>
          operation.type === 'update_node',
      )
      .map((operation) => [operation.nodeId, operation.patch]),
  );

  const nodes: ContractFlowNode[] = sourceNodes.map((node) => {
    const patched = nodeUpdates.has(node.id) ? { ...node, ...nodeUpdates.get(node.id) } : node;
    const diff = visibleProposal?.diff;
    const proposalState = diff?.addedNodeIds.includes(node.id)
      ? 'added'
      : diff?.removedNodeIds.includes(node.id)
        ? 'removed'
        : diff?.updatedNodeIds.includes(node.id)
          ? 'updated'
          : undefined;
    return {
      id: patched.id,
      type: 'contractNode',
      position: patched.position,
      initialWidth: 184,
      initialHeight: 114,
      data: { ...patched, proposalState },
    };
  });

  const baseEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const sourceEdges = [...graph.edges];
  for (const edge of preview.edges) {
    if (!baseEdgeIds.has(edge.id)) sourceEdges.push(edge);
  }
  const edgeUpdates = new Map(
    (visibleProposal?.operations ?? [])
      .filter(
        (operation): operation is Extract<GraphOperation, { type: 'update_edge' }> =>
          operation.type === 'update_edge',
      )
      .map((operation) => [operation.edgeId, operation.patch]),
  );

  const edges: Edge[] = sourceEdges.map((edge) => {
    const patched = edgeUpdates.has(edge.id) ? { ...edge, ...edgeUpdates.get(edge.id) } : edge;
    const added = visibleProposal?.diff.addedEdgeIds.includes(edge.id);
    const removed = visibleProposal?.diff.removedEdgeIds.includes(edge.id);
    const updated = visibleProposal?.diff.updatedEdgeIds.includes(edge.id);
    const color = added ? '#159160' : removed ? '#db4b55' : updated ? '#c47b24' : '#676b68';
    return {
      id: patched.id,
      type: 'smoothstep',
      className: `contract-edge contract-edge--${patched.mode}`,
      source: patched.source,
      target: patched.target,
      label: patched.label || (patched.mode === 'fallback' ? 'fallback' : undefined),
      markerEnd: { type: MarkerType.ArrowClosed, color },
      animated: Boolean(added),
      reconnectable: graph.status === 'draft' && !visibleProposal,
      interactionWidth: 28,
      pathOptions: { borderRadius: 16, offset: 28 },
      style: {
        stroke: color,
        strokeWidth: added || removed || updated ? 2.5 : 1.7,
        strokeDasharray: removed ? '6 5' : undefined,
        opacity: removed ? 0.65 : 1,
      },
      labelStyle: { fill: '#494c49', fontSize: 11, fontWeight: 700 },
      labelBgStyle: { fill: '#fbfaf7', fillOpacity: 0.92 },
      labelBgPadding: [5, 3] as [number, number],
      labelBgBorderRadius: 6,
      data: patched,
    };
  });

  return { nodes, edges };
}
