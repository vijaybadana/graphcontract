import { WorkflowGraph } from '@/src/domain';

const COLUMN_GAP = 240;
const ROW_GAP = 160;
const ORIGIN_X = 80;
const ORIGIN_Y = 100;

/**
 * Produces a deterministic left-to-right layout for an acyclic workflow.
 * Canonical positions are updated here so the canvas, exports, and WebMCP all
 * describe the same accepted graph after a structural proposal is approved.
 */
export function layoutWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = graph.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((left, right) => left.position.y - right.position.y || left.id.localeCompare(right.id))
    .map((node) => node.id);
  const rank = new Map(queue.map((nodeId) => [nodeId, 0]));
  const ordered: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    ordered.push(nodeId);
    const targets = [...(outgoing.get(nodeId) ?? [])].sort();
    for (const target of targets) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(nodeId) ?? 0) + 1));
      const remaining = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  // Validation rejects cycles; preserving existing positions is the safest
  // fallback if this helper is called before validation in another context.
  if (ordered.length !== graph.nodes.length) return structuredClone(graph);

  const layers = new Map<number, string[]>();
  for (const nodeId of ordered) {
    const layer = rank.get(nodeId) ?? 0;
    layers.set(layer, [...(layers.get(layer) ?? []), nodeId]);
  }
  for (const nodeIds of layers.values()) {
    nodeIds.sort((leftId, rightId) => {
      const left = nodeById.get(leftId)!;
      const right = nodeById.get(rightId)!;
      return left.position.y - right.position.y || left.id.localeCompare(right.id);
    });
  }

  const maxRows = Math.max(...[...layers.values()].map((nodeIds) => nodeIds.length), 1);
  const positions = new Map<string, { x: number; y: number }>();
  for (const [layer, nodeIds] of layers) {
    const centeredOffset = ((maxRows - nodeIds.length) * ROW_GAP) / 2;
    nodeIds.forEach((nodeId, row) => {
      positions.set(nodeId, {
        x: ORIGIN_X + layer * COLUMN_GAP,
        y: ORIGIN_Y + centeredOffset + row * ROW_GAP,
      });
    });
  }

  return {
    ...structuredClone(graph),
    nodes: graph.nodes.map((node) =>
      // Nested child positions are canonical relative coordinates. Structural
      // proposal layout may still arrange outer nodes, but must not turn a
      // child's relative position into an absolute canvas coordinate.
      node.parentId
        ? structuredClone(node)
        : { ...structuredClone(node), position: positions.get(node.id)! },
    ),
  };
}
