import type { GraphDimensions, GraphPosition, WorkflowGraph } from '@/src/domain';
import { CONTRACT_NODE_HEIGHT, CONTRACT_NODE_WIDTH } from './canvas-geometry';
import {
  constrainCanvasContainerDimensions,
  type CanvasContainerResizeLimits,
} from './subgraph-resize';

const MIN_DYNAMIC_WORKER_WIDTH = 288;
const MIN_DYNAMIC_WORKER_HEIGHT = 232;
const CONTENT_INSET = 24;

export type DynamicWorkerGroupLayout = {
  edgeId: string;
  templateNodeId: string;
  parentId?: string;
  position: GraphPosition;
  dimensions: GraphDimensions;
};

/**
 * Resolves the render-only worker group back to its canonical Send anatomy.
 * The group position is anchored by the one canonical template GraphNode.
 */
export function dynamicWorkerGroupLayout(
  graph: WorkflowGraph,
  edgeId: string,
): DynamicWorkerGroupLayout | undefined {
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  const anatomy = edge?.mode === 'send' ? edge.send?.templateAnatomy : undefined;
  const template = edge ? graph.nodes.find((node) => node.id === edge.target) : undefined;
  const canonicalAnatomyNode = anatomy?.nodes.find(
    (node) => node.id === anatomy.canonicalTemplateNodeId,
  );
  if (!edge || !anatomy || !template || !canonicalAnatomyNode) return undefined;

  return {
    edgeId,
    templateNodeId: template.id,
    ...(template.parentId ? { parentId: template.parentId } : {}),
    position: {
      x: template.position.x - canonicalAnatomyNode.position.x,
      y: template.position.y - canonicalAnatomyNode.position.y,
    },
    dimensions: { ...anatomy.dimensions },
  };
}

export function dynamicWorkerGroupResizeLimits(
  graph: WorkflowGraph,
  edgeId: string,
): CanvasContainerResizeLimits | undefined {
  const layout = dynamicWorkerGroupLayout(graph, edgeId);
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  const anatomy = edge?.mode === 'send' ? edge.send?.templateAnatomy : undefined;
  if (!layout || !anatomy) return undefined;

  const minWidth = Math.max(
    MIN_DYNAMIC_WORKER_WIDTH,
    ...anatomy.nodes.map((node) => node.position.x + node.dimensions.width + CONTENT_INSET),
  );
  const minHeight = Math.max(
    MIN_DYNAMIC_WORKER_HEIGHT,
    ...anatomy.nodes.map((node) => node.position.y + node.dimensions.height + CONTENT_INSET),
  );
  const parent = layout.parentId
    ? graph.subgraphs.find((subgraph) => subgraph.id === layout.parentId)
    : undefined;
  const parentMaxWidth = parent
    ? parent.dimensions.width - layout.position.x - CONTENT_INSET
    : Number.MAX_SAFE_INTEGER;
  const parentMaxHeight = parent
    ? parent.dimensions.height - layout.position.y - CONTENT_INSET
    : Number.MAX_SAFE_INTEGER;
  const anatomyNodeIds = new Set(anatomy.nodes.map((node) => node.id));
  const siblingNodes = graph.nodes
    .filter((node) => node.parentId === layout.parentId && !anatomyNodeIds.has(node.id))
    .map((node) => ({
      id: node.id,
      x: node.position.x - layout.position.x,
      y: node.position.y - layout.position.y,
      width: CONTRACT_NODE_WIDTH,
      height: CONTRACT_NODE_HEIGHT,
    }));
  const siblingSubgraphs = graph.subgraphs
    .filter((subgraph) => subgraph.parentId === layout.parentId)
    .map((subgraph) => ({
      id: subgraph.id,
      x: subgraph.position.x - layout.position.x,
      y: subgraph.position.y - layout.position.y,
      width: subgraph.dimensions.width,
      height: subgraph.dimensions.height,
    }));

  return {
    current: { ...layout.dimensions },
    minWidth,
    minHeight,
    maxWidth: Math.max(layout.dimensions.width, minWidth, parentMaxWidth),
    maxHeight: Math.max(layout.dimensions.height, minHeight, parentMaxHeight),
    obstacles: [...siblingNodes, ...siblingSubgraphs],
  };
}

export function constrainDynamicWorkerGroupDimensions(
  graph: WorkflowGraph,
  edgeId: string,
  requested: GraphDimensions,
) {
  const limits = dynamicWorkerGroupResizeLimits(graph, edgeId);
  return limits ? constrainCanvasContainerDimensions(requested, limits) : requested;
}
