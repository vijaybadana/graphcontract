import { CONTRACT_NODE_HEIGHT, CONTRACT_NODE_WIDTH } from './canvas-geometry';
import type { GraphSubgraph, WorkflowGraph } from '@/src/domain';

const MIN_SUBGRAPH_WIDTH = 340;
const MIN_SUBGRAPH_HEIGHT = 244;
const CONTENT_INSET = 36;
const COLLISION_GAP = 12;

export type SubgraphResizeObstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SubgraphResizeLimits = {
  current: GraphSubgraph['dimensions'];
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  obstacles: SubgraphResizeObstacle[];
};

const overlaps = (start: number, size: number, otherStart: number, otherSize: number) =>
  start < otherStart + otherSize && start + size > otherStart;

/**
 * Computes resize constraints in the subgraph's own parent coordinate space.
 * Only direct siblings can collide; descendants establish the minimum size.
 */
export function subgraphResizeLimits(
  graph: WorkflowGraph,
  subgraphId: string,
): SubgraphResizeLimits | undefined {
  const subgraph = graph.subgraphs.find((candidate) => candidate.id === subgraphId);
  if (!subgraph) return undefined;

  const directNodes = graph.nodes.filter((node) => node.parentId === subgraph.id);
  const directSubgraphs = graph.subgraphs.filter((candidate) => candidate.parentId === subgraph.id);
  const minWidth = Math.max(
    MIN_SUBGRAPH_WIDTH,
    ...directNodes.map((node) => node.position.x + CONTRACT_NODE_WIDTH + CONTENT_INSET),
    ...directSubgraphs.map((child) => child.position.x + child.dimensions.width + CONTENT_INSET),
  );
  const minHeight = Math.max(
    MIN_SUBGRAPH_HEIGHT,
    ...directNodes.map((node) => node.position.y + CONTRACT_NODE_HEIGHT + CONTENT_INSET),
    ...directSubgraphs.map((child) => child.position.y + child.dimensions.height + CONTENT_INSET),
  );

  const parent = subgraph.parentId
    ? graph.subgraphs.find((candidate) => candidate.id === subgraph.parentId)
    : undefined;
  const parentMaxWidth = parent
    ? parent.dimensions.width - subgraph.position.x - CONTENT_INSET
    : Number.MAX_SAFE_INTEGER;
  const parentMaxHeight = parent
    ? parent.dimensions.height - subgraph.position.y - CONTENT_INSET
    : Number.MAX_SAFE_INTEGER;

  const siblingNodes = graph.nodes
    .filter((node) => node.parentId === subgraph.parentId)
    .map((node) => ({
      id: node.id,
      x: node.position.x - subgraph.position.x,
      y: node.position.y - subgraph.position.y,
      width: CONTRACT_NODE_WIDTH,
      height: CONTRACT_NODE_HEIGHT,
    }));
  const siblingSubgraphs = graph.subgraphs
    .filter((candidate) => candidate.id !== subgraph.id && candidate.parentId === subgraph.parentId)
    .map((candidate) => ({
      id: candidate.id,
      x: candidate.position.x - subgraph.position.x,
      y: candidate.position.y - subgraph.position.y,
      width: candidate.dimensions.width,
      height: candidate.dimensions.height,
    }));

  return {
    current: { ...subgraph.dimensions },
    minWidth,
    minHeight,
    maxWidth: Math.max(subgraph.dimensions.width, minWidth, parentMaxWidth),
    maxHeight: Math.max(subgraph.dimensions.height, minHeight, parentMaxHeight),
    obstacles: [...siblingNodes, ...siblingSubgraphs],
  };
}

/** Clamps a bottom-right resize without moving the container or its children. */
export function constrainSubgraphDimensions(
  requested: GraphSubgraph['dimensions'],
  limits: SubgraphResizeLimits,
): GraphSubgraph['dimensions'] {
  let width = Math.min(Math.max(requested.width, limits.minWidth), limits.maxWidth);
  let height = Math.min(Math.max(requested.height, limits.minHeight), limits.maxHeight);

  for (const obstacle of limits.obstacles) {
    if (
      width > limits.current.width &&
      obstacle.x >= limits.current.width &&
      overlaps(0, height, obstacle.y, obstacle.height)
    ) {
      width = Math.min(width, Math.max(limits.current.width, obstacle.x - COLLISION_GAP));
    }
    if (
      height > limits.current.height &&
      obstacle.y >= limits.current.height &&
      overlaps(0, width, obstacle.x, obstacle.width)
    ) {
      height = Math.min(height, Math.max(limits.current.height, obstacle.y - COLLISION_GAP));
    }
  }

  return { width, height };
}
