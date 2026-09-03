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

const COLUMN_GAP = 120;
const ROW_GAP = 64;
const ORIGIN = { x: 80, y: 100 };
const SUBGRAPH_BODY_INSET = 36;
const SUBGRAPH_HEADER_HEIGHT = 56;
const MIN_SUBGRAPH_WIDTH = 340;
const MIN_SUBGRAPH_HEIGHT = 244;
const LOOP_CORRIDOR_OFFSET = 80;

type Dimensions = { width: number; height: number };

type LayoutUnit = {
  id: string;
  position: GraphPosition;
  dimensions: Dimensions;
};

type LayoutEdge = Pick<GraphEdge, 'id' | 'source' | 'target' | 'mode' | 'label' | 'condition'>;

type LayoutResult = {
  positions: Map<string, GraphPosition>;
  maxX: number;
  maxY: number;
};

export type WorkflowLayoutOptions = {
  /** Preserve authored relative child positions while still recomputing bounds. */
  authoredSubgraphIds?: ReadonlySet<string>;
};

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const comparePositions = (left: GraphPosition, right: GraphPosition) =>
  left.y - right.y || left.x - right.x;

const compareUnits = (left: LayoutUnit, right: LayoutUnit) =>
  comparePositions(left.position, right.position) || compareText(left.id, right.id);

/**
 * Keep the primary continuation ahead of explicitly labelled branches, then
 * order branches by their stable semantic text rather than their insertion
 * order. This makes conditional lanes repeatable after persistence round trips.
 */
const compareEdges = (left: LayoutEdge, right: LayoutEdge) => {
  const branchRank = (edge: LayoutEdge) =>
    edge.mode === 'normal' || edge.mode === 'send' ? 0 : edge.mode === 'fallback' ? 2 : 1;
  return (
    branchRank(left) - branchRank(right) ||
    compareText(left.label ?? '', right.label ?? '') ||
    compareText(left.condition ?? '', right.condition ?? '') ||
    compareText(left.target, right.target) ||
    compareText(left.id, right.id)
  );
};

const comparePath = (left: readonly number[], right: readonly number[]) => {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
};

/**
 * A return edge is presentation-derived, so the layout identifies the same
 * deterministic DFS back edges locally. They are excluded from rank assignment
 * and instead reserve vertical separation for the router's loop corridor.
 */
function loopEdgeIds(units: readonly LayoutUnit[], edges: readonly LayoutEdge[]): Set<string> {
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const outgoing = new Map<string, LayoutEdge[]>();
  for (const edge of edges) {
    if (!unitById.has(edge.source) || !unitById.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  for (const candidates of outgoing.values()) candidates.sort(compareEdges);

  const state = new Map<string, 'visiting' | 'visited'>();
  const loops = new Set<string>();
  const visit = (unitId: string) => {
    state.set(unitId, 'visiting');
    for (const edge of outgoing.get(unitId) ?? []) {
      if (state.get(edge.target) === 'visiting') {
        loops.add(edge.id);
      } else if (!state.has(edge.target)) {
        visit(edge.target);
      }
    }
    state.set(unitId, 'visited');
  };

  for (const unit of [...units].sort(compareUnits)) {
    if (!state.has(unit.id)) visit(unit.id);
  }
  return loops;
}

/**
 * Lays one scope with a compact Sugiyama-style LR pass. The graph model has
 * one subgraph containment level today, but the scope routine is deliberately
 * recursive at the caller so each compound container owns relative child
 * coordinates and its own dimensions.
 */
function layoutScope(
  units: readonly LayoutUnit[],
  edges: readonly LayoutEdge[],
  origin: GraphPosition,
): LayoutResult {
  if (units.length === 0) {
    return { positions: new Map(), maxX: origin.x, maxY: origin.y };
  }

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const validEdges = edges.filter(
    (edge) => unitById.has(edge.source) && unitById.has(edge.target) && edge.source !== edge.target,
  );
  const loops = loopEdgeIds(units, validEdges);
  const outgoing = new Map<string, LayoutEdge[]>();
  const indegree = new Map(units.map((unit) => [unit.id, 0]));
  const loopBias = new Map(units.map((unit) => [unit.id, 0]));

  for (const edge of validEdges) {
    if (loops.has(edge.id)) {
      loopBias.set(edge.source, (loopBias.get(edge.source) ?? 0) + 1);
      loopBias.set(edge.target, (loopBias.get(edge.target) ?? 0) - 1);
      continue;
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  for (const candidates of outgoing.values()) candidates.sort(compareEdges);

  const queue = [...units].filter((unit) => indegree.get(unit.id) === 0).sort(compareUnits);
  const rank = new Map(units.map((unit) => [unit.id, 0]));
  const path = new Map<string, number[]>();
  queue.forEach((unit, index) => path.set(unit.id, [index]));
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current.id);
    const currentPath = path.get(current.id) ?? [Number.MAX_SAFE_INTEGER];
    for (const [edgeIndex, edge] of (outgoing.get(current.id) ?? []).entries()) {
      const targetPath = [...currentPath, edgeIndex];
      const knownPath = path.get(edge.target);
      if (!knownPath || comparePath(targetPath, knownPath) < 0) path.set(edge.target, targetPath);
      rank.set(edge.target, Math.max(rank.get(edge.target) ?? 0, (rank.get(current.id) ?? 0) + 1));
      const remaining = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, remaining);
      if (remaining === 0) {
        queue.push(unitById.get(edge.target)!);
        queue.sort(compareUnits);
      }
    }
  }

  // Removing DFS back edges must make every component acyclic. Keep this
  // defensive fallback deterministic for incomplete drafts instead of leaving
  // their geometry unchanged or leaking projection-only identifiers.
  for (const unit of [...units].sort(compareUnits)) {
    if (!ordered.includes(unit.id)) {
      ordered.push(unit.id);
      path.set(unit.id, [Number.MAX_SAFE_INTEGER, ordered.length]);
    }
  }

  const layers = new Map<number, string[]>();
  for (const unitId of ordered) {
    const layer = rank.get(unitId) ?? 0;
    layers.set(layer, [...(layers.get(layer) ?? []), unitId]);
  }
  for (const unitIds of layers.values()) {
    unitIds.sort((leftId, rightId) => {
      const pathOrder = comparePath(path.get(leftId) ?? [], path.get(rightId) ?? []);
      return pathOrder || compareUnits(unitById.get(leftId)!, unitById.get(rightId)!);
    });
  }

  const layerHeights = new Map<number, number>();
  const layerWidths = new Map<number, number>();
  for (const [layer, unitIds] of layers) {
    const layerUnits = unitIds.map((unitId) => unitById.get(unitId)!);
    layerHeights.set(
      layer,
      layerUnits.reduce((height, unit) => height + unit.dimensions.height, 0) +
        Math.max(0, layerUnits.length - 1) * ROW_GAP,
    );
    layerWidths.set(layer, Math.max(...layerUnits.map((unit) => unit.dimensions.width)));
  }
  const canvasHeight = Math.max(...layerHeights.values());
  const positions = new Map<string, GraphPosition>();
  let columnX = origin.x;

  for (const layer of [...layers.keys()].sort((left, right) => left - right)) {
    const unitIds = layers.get(layer)!;
    let rowY = origin.y + (canvasHeight - (layerHeights.get(layer) ?? 0)) / 2;
    for (const unitId of unitIds) {
      const unit = unitById.get(unitId)!;
      const desiredY = rowY + (loopBias.get(unitId) ?? 0) * LOOP_CORRIDOR_OFFSET;
      // A layer never overlaps even where several loop corridors meet. The
      // deterministic positive clearance is a geometry hint for the existing
      // SVG/React Flow loop router, not new canonical edge data.
      const position = { x: columnX, y: Math.max(rowY, desiredY) };
      positions.set(unitId, position);
      rowY = position.y + unit.dimensions.height + ROW_GAP;
    }
    columnX += (layerWidths.get(layer) ?? 0) + COLUMN_GAP;
  }

  const allPositions = [...positions.entries()];
  const minimumY = Math.min(...allPositions.map(([, position]) => position.y));
  if (minimumY < origin.y) {
    const correction = origin.y - minimumY;
    for (const [unitId, position] of allPositions) {
      positions.set(unitId, { ...position, y: position.y + correction });
    }
  }

  const maxX = Math.max(
    ...[...positions.entries()].map(([unitId, position]) =>
      position.x + unitById.get(unitId)!.dimensions.width,
    ),
  );
  const maxY = Math.max(
    ...[...positions.entries()].map(([unitId, position]) =>
      position.y + unitById.get(unitId)!.dimensions.height,
    ),
  );
  return { positions, maxX, maxY };
}

const nodeUnit = (node: GraphNode): LayoutUnit => ({
  id: node.id,
  position: node.position,
  dimensions: { width: CONTRACT_NODE_WIDTH, height: CONTRACT_NODE_HEIGHT },
});

const geometryForSubgraph = (
  subgraph: GraphSubgraph,
  children: readonly GraphNode[],
  edges: readonly GraphEdge[],
  preserveAuthoredComposition: boolean,
) => {
  if (preserveAuthoredComposition && children.length > 0) {
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
      subgraph: {
        ...subgraph,
        dimensions: {
          // Authored compound layouts may intentionally reserve workspace for
          // readable nested flows. Content can grow the boundary, but repeated
          // layout passes must not shrink that declared canvas.
          width: Math.max(subgraph.dimensions.width, MIN_SUBGRAPH_WIDTH, maxX + SUBGRAPH_BODY_INSET),
          height: Math.max(subgraph.dimensions.height, MIN_SUBGRAPH_HEIGHT, maxY + SUBGRAPH_BODY_INSET),
        },
      },
    };
  }

  const childIds = new Set(children.map((child) => child.id));
  const result = layoutScope(
    children.map(nodeUnit),
    edges.filter((edge) => childIds.has(edge.source) && childIds.has(edge.target)),
    { x: SUBGRAPH_BODY_INSET, y: SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_BODY_INSET },
  );
  return {
    positions: result.positions,
    subgraph: {
      ...subgraph,
      dimensions: {
        width: Math.max(MIN_SUBGRAPH_WIDTH, result.maxX + SUBGRAPH_BODY_INSET),
        height: Math.max(MIN_SUBGRAPH_HEIGHT, result.maxY + SUBGRAPH_BODY_INSET),
      },
    },
  };
};

/**
 * Produces canonical node and subgraph geometry without mutating the input.
 * Edges remain byte-for-byte canonical: compound containers only stand in for
 * their children during rank calculation, never in the returned topology.
 */
export function layoutWorkflowGraph(
  graph: WorkflowGraph,
  options: WorkflowLayoutOptions = {},
): WorkflowGraph {
  const next = structuredClone(graph);
  const subgraphIds = new Set(next.subgraphs.map((subgraph) => subgraph.id));
  const childPositions = new Map<string, GraphPosition>();
  const sizedSubgraphs = new Map<string, GraphSubgraph>();

  for (const subgraph of next.subgraphs) {
    const children = next.nodes.filter((node) => node.parentId === subgraph.id);
    const containsDeclaredTemplateAnatomy = next.edges.some((edge) => (
      edge.mode === 'send'
      && Boolean(edge.send.templateAnatomy)
      && children.some((node) => node.id === edge.target)
    ));
    const geometry = geometryForSubgraph(
      subgraph,
      children,
      next.edges,
      (options.authoredSubgraphIds?.has(subgraph.id) ?? false) || containsDeclaredTemplateAnatomy,
    );
    sizedSubgraphs.set(subgraph.id, geometry.subgraph);
    for (const [nodeId, position] of geometry.positions) childPositions.set(nodeId, position);
  }

  const outerUnits: LayoutUnit[] = [
    ...next.nodes.filter((node) => !node.parentId || !subgraphIds.has(node.parentId)).map(nodeUnit),
    ...next.subgraphs.map((subgraph) => {
      const sized = sizedSubgraphs.get(subgraph.id)!;
      return { id: sized.id, position: sized.position, dimensions: sized.dimensions };
    }),
  ];
  const unitForNode = (nodeId: string) => {
    const node = next.nodes.find((candidate) => candidate.id === nodeId);
    return node?.parentId && subgraphIds.has(node.parentId) ? node.parentId : node?.id;
  };
  const outerEdges: LayoutEdge[] = next.edges.flatMap((edge) => {
    const source = unitForNode(edge.source);
    const target = unitForNode(edge.target);
    return source && target && source !== target ? [{ ...edge, source, target }] : [];
  });
  const outerGeometry = layoutScope(outerUnits, outerEdges, ORIGIN);

  return {
    ...next,
    nodes: next.nodes.map((node) => ({
      ...node,
      position: childPositions.get(node.id) ?? outerGeometry.positions.get(node.id) ?? node.position,
    })),
    subgraphs: next.subgraphs.map((subgraph) => {
      const sized = sizedSubgraphs.get(subgraph.id)!;
      return {
        ...sized,
        position: outerGeometry.positions.get(subgraph.id) ?? sized.position,
      };
    }),
  };
}
