import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';

import {
  GraphEdge,
  GraphNode,
  GraphPosition,
  GraphSubgraph,
  WorkflowGraph,
} from '@/src/domain';

import {
  CONTRACT_NODE_HEIGHT,
  CONTRACT_NODE_WIDTH,
} from './canvas-geometry';

const ORIGIN = { x: 80, y: 100 };
const SUBGRAPH_BODY_INSET = 36;
const SUBGRAPH_HEADER_HEIGHT = 56;
const MIN_SUBGRAPH_WIDTH = 340;
const MIN_SUBGRAPH_HEIGHT = 244;
const ROOT_ID = '__graphcontract_elk_root__';
const LAYOUT_CACHE_LIMIT = 64;

type Dimensions = { width: number; height: number };
type PortSide = 'WEST' | 'EAST';

/** React Flow handle ids shared with the render registry. */
export const CANVAS_INPUT_PORT_ID = 'graphcontract-west';
export const CANVAS_OUTPUT_PORT_ID = 'graphcontract-east';

/**
 * A schema-independent compound input. The workflow schema presently has one
 * subgraph level, but this adapter deliberately accepts arbitrary depth so
 * layout behavior is not coupled to that current persistence limitation.
 */
export type CompoundLayoutNode<T> = {
  id: string;
  value?: T;
  dimensions: Dimensions;
  children?: readonly CompoundLayoutNode<T>[];
};

export type CompoundLayoutEdge = {
  id: string;
  source: string;
  target: string;
};

export type CompoundLayoutGeometry = {
  position: GraphPosition;
  dimensions: Dimensions;
  parentId?: string;
};

export type ElkLayoutRunner = (graph: ElkNode) => Promise<ElkNode>;

export type WorkflowLayoutOptions = {
  /** Preserve authored relative child positions while still recomputing bounds. */
  authoredSubgraphIds?: ReadonlySet<string>;
  /** Keep an authored fixture byte-for-byte, including all geometry. */
  preserveGraphGeometry?: boolean;
};

const elk = new ELK();
const layoutGeometryCache = new Map<string, Promise<Map<string, CompoundLayoutGeometry>>>();

export const canvasPortId = (side: PortSide) => (
  side === 'WEST' ? CANVAS_INPUT_PORT_ID : CANVAS_OUTPUT_PORT_ID
);

const elkPortId = (nodeId: string, side: PortSide) => `${nodeId}::${canvasPortId(side)}`;

const explicitPort = (nodeId: string, side: PortSide) => ({
  id: elkPortId(nodeId, side),
  width: 1,
  height: 1,
  layoutOptions: { 'elk.port.side': side },
});

const descendants = <T>(node: CompoundLayoutNode<T>): readonly CompoundLayoutNode<T>[] =>
  [node, ...(node.children ?? []).flatMap(descendants)];

const nodeIds = <T>(root: CompoundLayoutNode<T>) => new Set(descendants(root).map((node) => node.id));

/**
 * Converts a reusable compound tree into ELK's hierarchy format. Every real
 * node receives stable WEST/EAST ports; the only translated edge data lives in
 * this transient ELK request and never reaches the canonical workflow graph.
 */
export function toElkCompoundGraph<T>(
  root: CompoundLayoutNode<T>,
  edges: readonly CompoundLayoutEdge[],
): ElkNode {
  const ids = nodeIds(root);
  const convert = (node: CompoundLayoutNode<T>, isRoot = false): ElkNode => ({
    id: node.id,
    width: node.dimensions.width,
    height: node.dimensions.height,
    ...(!isRoot ? {
      ports: [explicitPort(node.id, 'WEST'), explicitPort(node.id, 'EAST')],
      layoutOptions: node.children
        ? {
            'elk.padding': `[top=${SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_BODY_INSET},left=${SUBGRAPH_BODY_INSET},bottom=${SUBGRAPH_BODY_INSET},right=${SUBGRAPH_BODY_INSET}]`,
            'elk.portConstraints': 'FIXED_SIDE',
          }
        : { 'elk.portConstraints': 'FIXED_SIDE' },
    } : {
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.spacing.nodeNode': '64',
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      },
    }),
    ...(node.children ? { children: node.children.map((child) => convert(child)) } : {}),
  });

  const elkRoot = convert(root, true);
  elkRoot.edges = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      sources: [elkPortId(edge.source, 'EAST')],
      targets: [elkPortId(edge.target, 'WEST')],
    }));
  return elkRoot;
}

/** Maps ELK output back to the source hierarchy without leaking ELK edge data. */
export function mapElkCompoundGeometry<T>(
  root: CompoundLayoutNode<T>,
  laidOutRoot: ElkNode,
): Map<string, CompoundLayoutGeometry> {
  const geometry = new Map<string, CompoundLayoutGeometry>();
  const visit = (
    source: CompoundLayoutNode<T>,
    laidOut: ElkNode,
    parentId?: string,
  ) => {
    if (source.id !== ROOT_ID) {
      geometry.set(source.id, {
        position: { x: laidOut.x ?? 0, y: laidOut.y ?? 0 },
        dimensions: {
          width: laidOut.width ?? source.dimensions.width,
          height: laidOut.height ?? source.dimensions.height,
        },
        ...(parentId ? { parentId } : {}),
      });
    }
    const laidOutChildren = new Map((laidOut.children ?? []).map((child) => [child.id, child]));
    for (const child of source.children ?? []) {
      const laidOutChild = laidOutChildren.get(child.id);
      if (!laidOutChild) continue;
      visit(child, laidOutChild, source.id === ROOT_ID ? undefined : source.id);
    }
  };
  visit(root, laidOutRoot);
  return geometry;
}

/** Runs ELK and returns only node/container geometry, recursively parent-relative. */
export async function layoutCompoundGeometry<T>(
  root: CompoundLayoutNode<T>,
  edges: readonly CompoundLayoutEdge[],
  runner: ElkLayoutRunner = (graph) => elk.layout(graph),
): Promise<Map<string, CompoundLayoutGeometry>> {
  const laidOut = await runner(toElkCompoundGraph(root, edges));
  return mapElkCompoundGeometry(root, laidOut);
}

type AuthoredSubgraphGeometry = {
  positions: Map<string, GraphPosition>;
  dimensions: Dimensions;
};

const containsDeclaredTemplateAnatomy = (
  children: readonly GraphNode[],
  edges: readonly GraphEdge[],
) => {
  const childIds = new Set(children.map((child) => child.id));
  return edges.some((edge) => (
    edge.mode === 'send'
    && Boolean(edge.send.templateAnatomy)
    && childIds.has(edge.target)
  ));
};

/**
 * The explicit authored-layout escape hatch is intentionally local. It keeps
 * child positions stable while normalizing their origin and fitting the parent
 * around every declared child/template extent.
 */
function authoredSubgraphGeometry(
  subgraph: GraphSubgraph,
  children: readonly GraphNode[],
  edges: readonly GraphEdge[],
): AuthoredSubgraphGeometry {
  if (children.length === 0) {
    return {
      positions: new Map(),
      dimensions: {
        width: Math.max(subgraph.dimensions.width, MIN_SUBGRAPH_WIDTH),
        height: Math.max(subgraph.dimensions.height, MIN_SUBGRAPH_HEIGHT),
      },
    };
  }
  const childById = new Map(children.map((child) => [child.id, child]));
  const declaredTemplateBounds = edges.flatMap((edge) => {
    if (edge.mode !== 'send' || !edge.send.templateAnatomy) return [];
    const template = childById.get(edge.target);
    const anatomy = edge.send.templateAnatomy;
    const anchor = anatomy.nodes.find((node) => node.id === anatomy.canonicalTemplateNodeId);
    if (!template || !anchor) return [];
    return [{
      x: template.position.x - anchor.position.x,
      y: template.position.y - anchor.position.y,
      width: anatomy.dimensions.width,
      height: anatomy.dimensions.height,
    }];
  });
  const minimumX = Math.min(
    ...children.map((child) => child.position.x),
    ...declaredTemplateBounds.map((bounds) => bounds.x),
  );
  const minimumY = Math.min(
    ...children.map((child) => child.position.y),
    ...declaredTemplateBounds.map((bounds) => bounds.y),
  );
  const shiftX = Math.max(0, SUBGRAPH_BODY_INSET - minimumX);
  const shiftY = Math.max(0, SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_BODY_INSET - minimumY);
  const positions = new Map(
    children.map((child) => [
      child.id,
      { x: child.position.x + shiftX, y: child.position.y + shiftY },
    ]),
  );
  const maxX = Math.max(
    ...[...positions.values()].map((position) => position.x + CONTRACT_NODE_WIDTH),
    ...declaredTemplateBounds.map((bounds) => bounds.x + shiftX + bounds.width),
  );
  const maxY = Math.max(
    ...[...positions.values()].map((position) => position.y + CONTRACT_NODE_HEIGHT),
    ...declaredTemplateBounds.map((bounds) => bounds.y + shiftY + bounds.height),
  );
  return {
    positions,
    dimensions: {
      width: Math.max(subgraph.dimensions.width, MIN_SUBGRAPH_WIDTH, maxX + SUBGRAPH_BODY_INSET),
      height: Math.max(subgraph.dimensions.height, MIN_SUBGRAPH_HEIGHT, maxY + SUBGRAPH_BODY_INSET),
    },
  };
}

type WorkflowTree = CompoundLayoutNode<GraphNode | GraphSubgraph>;

type WorkflowLayoutInput = {
  root: WorkflowTree;
  edges: CompoundLayoutEdge[];
  authoredGeometry: Map<string, AuthoredSubgraphGeometry>;
};

const nodeDimensions = (): Dimensions => ({
  width: CONTRACT_NODE_WIDTH,
  height: CONTRACT_NODE_HEIGHT,
});

function buildWorkflowLayoutInput(
  graph: WorkflowGraph,
  options: WorkflowLayoutOptions,
): WorkflowLayoutInput {
  const subgraphById = new Map(graph.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const childrenBySubgraphId = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    if (!node.parentId || !subgraphById.has(node.parentId)) continue;
    childrenBySubgraphId.set(node.parentId, [...(childrenBySubgraphId.get(node.parentId) ?? []), node]);
  }

  const authoredGeometry = new Map<string, AuthoredSubgraphGeometry>();
  const authoredIds = new Set<string>();
  for (const subgraph of graph.subgraphs) {
    const children = childrenBySubgraphId.get(subgraph.id) ?? [];
    if (
      options.authoredSubgraphIds?.has(subgraph.id)
      || containsDeclaredTemplateAnatomy(children, graph.edges)
    ) {
      authoredIds.add(subgraph.id);
      authoredGeometry.set(subgraph.id, authoredSubgraphGeometry(subgraph, children, graph.edges));
    }
  }

  const normalSubgraph = (subgraph: GraphSubgraph): WorkflowTree => {
    if (subgraph.collapsed) {
      // The canonical dimensions remember the expanded boundary. ELK only
      // needs the compact visible footprint while this container is closed.
      return {
        id: subgraph.id,
        value: subgraph,
        dimensions: nodeDimensions(),
      };
    }
    const authored = authoredGeometry.get(subgraph.id);
    if (authored) {
      // Deliberately present an authored compound as one transient ELK unit.
      // Its internal canonical nodes/edges are preserved by the local opt-out.
      return { id: subgraph.id, value: subgraph, dimensions: authored.dimensions };
    }
    return {
      id: subgraph.id,
      value: subgraph,
      dimensions: {
        width: MIN_SUBGRAPH_WIDTH,
        height: MIN_SUBGRAPH_HEIGHT,
      },
      children: (childrenBySubgraphId.get(subgraph.id) ?? []).map((node) => ({
        id: node.id,
        value: node,
        dimensions: nodeDimensions(),
      })),
    };
  };

  const rootChildren: WorkflowTree[] = [
    ...graph.nodes
      .filter((node) => !node.parentId || !subgraphById.has(node.parentId))
      .map((node) => ({ id: node.id, value: node, dimensions: nodeDimensions() })),
    ...graph.subgraphs.map(normalSubgraph),
  ];

  const unitForNode = (nodeId: string) => {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return undefined;
    const parent = node.parentId ? subgraphById.get(node.parentId) : undefined;
    return parent && (parent.collapsed || authoredIds.has(parent.id)) ? parent.id : node.id;
  };

  const edges = graph.edges.flatMap((edge) => {
    const source = unitForNode(edge.source);
    const target = unitForNode(edge.target);
    return source && target && source !== target ? [{ id: edge.id, source, target }] : [];
  });

  return {
    root: { id: ROOT_ID, dimensions: { width: 0, height: 0 }, children: rootChildren },
    edges,
    authoredGeometry,
  };
}

const workflowStructuralSignature = (
  graph: WorkflowGraph,
  options: WorkflowLayoutOptions,
) => JSON.stringify({
  nodes: graph.nodes.map((node) => ({ id: node.id, parentId: node.parentId, kind: node.kind })),
  subgraphs: graph.subgraphs.map((subgraph) => ({
    id: subgraph.id,
    collapsed: subgraph.collapsed,
  })),
  edges: graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  authoredSubgraphIds: [...(options.authoredSubgraphIds ?? [])].sort(),
});

const positionAtRoot = (geometry: CompoundLayoutGeometry) => (
  geometry.parentId
    ? geometry.position
    : { x: geometry.position.x + ORIGIN.x, y: geometry.position.y + ORIGIN.y }
);

function applyWorkflowGeometry(
  graph: WorkflowGraph,
  geometry: Map<string, CompoundLayoutGeometry>,
  authoredGeometry: ReadonlyMap<string, AuthoredSubgraphGeometry>,
): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const authoredParent = node.parentId ? authoredGeometry.get(node.parentId) : undefined;
      const laidOut = geometry.get(node.id);
      return {
        ...node,
        position: authoredParent?.positions.get(node.id) ?? (laidOut ? positionAtRoot(laidOut) : node.position),
      };
    }),
    subgraphs: graph.subgraphs.map((subgraph) => {
      const authored = authoredGeometry.get(subgraph.id);
      const laidOut = geometry.get(subgraph.id);
      return {
        ...subgraph,
        position: laidOut ? positionAtRoot(laidOut) : subgraph.position,
        // Closing a container changes only its projected footprint. Retain
        // canonical expanded dimensions so reopening cannot destroy geometry.
        dimensions: subgraph.collapsed
          ? subgraph.dimensions
          : authored?.dimensions ?? laidOut?.dimensions ?? subgraph.dimensions,
      };
    }),
  };
}

/**
 * Produces only canonical node/subgraph geometry. The asynchronous ELK request
 * is cached by topology, while the result mapper always applies that geometry
 * to the caller's current graph so edge and semantic fields stay byte-for-byte.
 */
export async function layoutWorkflowGraph(
  graph: WorkflowGraph,
  options: WorkflowLayoutOptions = {},
): Promise<WorkflowGraph> {
  if (options.preserveGraphGeometry) return structuredClone(graph);

  const input = buildWorkflowLayoutInput(graph, options);
  const hasAuthoredGeometry = input.authoredGeometry.size > 0;
  const key = workflowStructuralSignature(graph, options);
  let geometryPromise = hasAuthoredGeometry ? undefined : layoutGeometryCache.get(key);
  if (!geometryPromise) {
    geometryPromise = layoutCompoundGeometry(input.root, input.edges);
    if (!hasAuthoredGeometry) {
      layoutGeometryCache.set(key, geometryPromise);
      if (layoutGeometryCache.size > LAYOUT_CACHE_LIMIT) {
        const oldestKey = layoutGeometryCache.keys().next().value;
        if (oldestKey) layoutGeometryCache.delete(oldestKey);
      }
      void geometryPromise.catch(() => layoutGeometryCache.delete(key));
    }
  }
  const geometry = await geometryPromise;
  return applyWorkflowGeometry(graph, geometry, input.authoredGeometry);
}
