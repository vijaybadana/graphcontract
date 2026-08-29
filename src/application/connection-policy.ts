import { EdgeMode, GraphEdge, WorkflowGraph } from '@/src/domain';

export type ConnectionCandidate = {
  source: string | null;
  target: string | null;
};

export type ConnectionDecision = {
  valid: boolean;
  code?:
    | 'MISSING_NODE'
    | 'SELF_CONNECTION'
    | 'START_INCOMING'
    | 'END_OUTGOING'
    | 'DUPLICATE_CONNECTION'
    | 'ROUTING_LIMIT'
    | 'INVALID_SUBGRAPH_ENTRY'
    | 'INVALID_SUBGRAPH_EXIT'
    | 'SUBGRAPH_END_NORMAL_REQUIRED';
};

const invalid = (code: NonNullable<ConnectionDecision['code']>): ConnectionDecision => ({
  valid: false,
  code,
});

export function suggestedEdgeMode(graph: WorkflowGraph, source: string): EdgeMode {
  const outgoing = graph.edges.filter((edge) => edge.source === source);
  if (outgoing.some((edge) => edge.mode === 'conditional' || edge.mode === 'fallback')) {
    return 'conditional';
  }
  return outgoing.some((edge) => edge.mode === 'command') ? 'command' : 'normal';
}

export function evaluateConnection(
  graph: WorkflowGraph,
  candidate: ConnectionCandidate,
  options: { reconnectingEdgeId?: string | null } = {},
): ConnectionDecision {
  const { source, target } = candidate;
  if (!source || !target) return invalid('MISSING_NODE');
  if (source === target) return invalid('SELF_CONNECTION');

  const sourceNode = graph.nodes.find((node) => node.id === source);
  const targetNode = graph.nodes.find((node) => node.id === target);
  if (!sourceNode || !targetNode) return invalid('MISSING_NODE');
  if (sourceNode.kind === 'end' && !sourceNode.parentId) return invalid('END_OUTGOING');
  if (targetNode.kind === 'start' && !targetNode.parentId) return invalid('START_INCOMING');

  const crossesSubgraphBoundary = sourceNode.parentId !== targetNode.parentId;
  if (sourceNode.kind === 'end' && sourceNode.parentId && !crossesSubgraphBoundary) {
    return invalid('INVALID_SUBGRAPH_EXIT');
  }
  if (targetNode.kind === 'start' && targetNode.parentId && !crossesSubgraphBoundary) {
    return invalid('INVALID_SUBGRAPH_ENTRY');
  }
  if (crossesSubgraphBoundary) {
    if (sourceNode.parentId && sourceNode.kind !== 'end') return invalid('INVALID_SUBGRAPH_EXIT');
    if (targetNode.parentId && targetNode.kind !== 'start') return invalid('INVALID_SUBGRAPH_ENTRY');
  }

  const edges = graph.edges.filter((edge) => edge.id !== options.reconnectingEdgeId);
  if (edges.some((edge) => edge.source === source && edge.target === target)) {
    return invalid('DUPLICATE_CONNECTION');
  }

  const reconnectingEdge = options.reconnectingEdgeId
    ? graph.edges.find((edge) => edge.id === options.reconnectingEdgeId)
    : undefined;
  const mode = reconnectingEdge?.mode ?? suggestedEdgeMode({ ...graph, edges }, source);
  if (sourceNode.kind === 'end' && sourceNode.parentId && mode !== 'normal') {
    return invalid('SUBGRAPH_END_NORMAL_REQUIRED');
  }
  const outgoing = edges.filter((edge) => edge.source === source);
  if (mode === 'normal' && outgoing.length > 0) return invalid('ROUTING_LIMIT');
  if (
    mode === 'conditional' &&
    (outgoing.some((edge) => edge.mode === 'normal') ||
      outgoing.filter((edge) => edge.mode === 'conditional').length >= 5)
  ) {
    return invalid('ROUTING_LIMIT');
  }
  if (
    mode === 'fallback' &&
    outgoing.some((edge) => edge.mode === 'normal' || edge.mode === 'fallback')
  ) {
    return invalid('ROUTING_LIMIT');
  }

  return { valid: true };
}

export function createDraftEdge(
  graph: WorkflowGraph,
  edgeId: string,
  source: string,
  target: string,
): GraphEdge {
  const mode = suggestedEdgeMode(graph, source);
  const branchNumber = graph.edges.filter(
    (edge) => edge.source === source && edge.mode === 'conditional',
  ).length + 1;
  const commandNumber = graph.edges.filter(
    (edge) => edge.source === source && edge.mode === 'command',
  ).length + 1;
  return {
    id: edgeId,
    source,
    target,
    mode,
    ...(mode === 'conditional'
      ? { label: `branch ${branchNumber}` }
      : mode === 'command'
        ? { label: `command ${commandNumber}` }
        : {}),
  };
}
