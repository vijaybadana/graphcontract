import { Edge, MarkerType } from '@xyflow/react';

import {
  GraphEdge,
  GraphNode,
  GraphSubgraph,
  NonNativeRelationship,
  Provenance,
  ProvenanceRepresentation,
  resolveEffectiveCapabilities,
  RuntimeProjectionFixture,
  validateGraph,
  WorkflowGraph,
} from '@/src/domain';
import type {
  ProposalComparisonEntry,
  ProposalReview,
} from '@/src/application/proposal-comparison';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
  canvasNodeRenderer,
} from '@/src/features/canvas/canvas-render-registry';
import {
  resolveRoutingEdgeLabel,
  resolveRoutingEdgePresentation,
} from '@/src/features/canvas/routing-edge-presentation';
import {
  runtimeProjectionAvailability,
} from '@/src/features/workspace/runtime-projection';
import {
  ScenarioElementState,
  ScenarioPresentation,
  scenarioElementState,
  scenarioPresentationClassName,
} from '@/src/features/scenarios/scenario-presentation';

const SUBGRAPH_BODY_INSET = 12;
const SUBGRAPH_HEADER_HEIGHT = 56;
const RUNTIME_INSTANCE_WIDTH = canvasNodeRenderer('runtimeInstance').dimensions.width;
const RUNTIME_INSTANCE_HEIGHT = canvasNodeRenderer('runtimeInstance').dimensions.height;
const RUNTIME_INSTANCE_VERTICAL_GAP = 20;
const DYNAMIC_WORKER_GROUP_MIN_WIDTH = canvasNodeRenderer('dynamicWorkerGroup').dimensions.width;
const DYNAMIC_WORKER_GROUP_MIN_HEIGHT = canvasNodeRenderer('dynamicWorkerGroup').dimensions.height;
const DYNAMIC_WORKER_GROUP_INSET_X = 34;
const DYNAMIC_WORKER_GROUP_INSET_Y = 76;

export type CanvasEdgeData = {
  edge: GraphEdge;
  domainEdgeIds: string[];
  projection: 'domain' | 'subgraph-proxy' | 'template-boundary' | 'runtime-instance';
  /** Review metadata stays keyed by canonical edges even when endpoints collapse. */
  review?: CanvasEdgeReviewProjection;
  runtimeInstanceId?: string;
  /** Evidence markers are an optional, workspace-only overlay. */
  evidenceMarker?: number;
  onEvidenceActivate?: (edgeId: string) => void;
  /** Ephemeral proposal-detail focus; never serialized into the graph. */
  reviewFocusState?: 'active' | 'dimmed';
  presentation: CanvasEdgePresentation;
  [key: string]: unknown;
};

export type CanvasNativeEdge = Edge<CanvasEdgeData, 'routing'>;

export type ProposalVisualState = 'added' | 'updated' | 'removed';
export type CanvasReviewState = ProposalVisualState | 'unchanged';
export type CanvasReviewAggregate = CanvasReviewState | 'mixed';
export type CanvasEdgeReviewProjection = {
  aggregate: CanvasReviewAggregate;
  byDomainEdgeId: Readonly<Record<string, CanvasReviewState>>;
};

export type CanvasReviewElementStates = {
  nodes: Readonly<Record<string, CanvasReviewState>>;
  subgraphs: Readonly<Record<string, CanvasReviewState>>;
  nativeEdges: Readonly<Record<string, CanvasReviewState>>;
  relationships: Readonly<Record<string, CanvasReviewState>>;
};

/**
 * Canvas review input is detached from proposal operations and stored diffs.
 * A comparable review supplies the already-derived final candidate plus
 * stable-ID states; a stale review deliberately has no candidate branch.
 */
export type CanvasReviewProjection =
  | {
      kind: 'comparable';
      accepted: WorkflowGraph;
      candidate: WorkflowGraph;
      states: CanvasReviewElementStates;
      membershipChangedNodeIds: readonly string[];
      membershipAffectedSubgraphIds: readonly string[];
    }
  | {
      kind: 'stale';
      accepted: WorkflowGraph;
    };

function reviewStatesById<T>(
  entries: Readonly<Record<string, ProposalComparisonEntry<T>>>,
): Readonly<Record<string, CanvasReviewState>> {
  return Object.freeze(Object.fromEntries(
    Object.values(entries).map((entry) => [entry.id, entry.state]),
  ));
}

/** Purely adapts the one authoritative proposal review for canvas consumers. */
export function proposalReviewToCanvasProjection(
  review: ProposalReview | null,
): CanvasReviewProjection | null {
  if (!review) return null;
  if (review.kind === 'stale') {
    return Object.freeze({ kind: 'stale', accepted: review.accepted });
  }

  const membershipChangedNodeIds = Object.values(review.nodes)
    .filter((entry) =>
      entry.before !== undefined &&
      entry.after !== undefined &&
      entry.before.parentId !== entry.after.parentId,
    )
    .map((entry) => entry.id)
    .sort();
  const membershipAffectedSubgraphIds = [...new Set(
    membershipChangedNodeIds.flatMap((nodeId) => {
      const entry = review.nodes[nodeId];
      return [entry.before?.parentId, entry.after?.parentId].filter(
        (subgraphId): subgraphId is string => Boolean(subgraphId),
      );
    }),
  )].sort();

  return Object.freeze({
    kind: 'comparable',
    accepted: review.base,
    candidate: review.candidate,
    states: Object.freeze({
      nodes: reviewStatesById(review.nodes),
      subgraphs: reviewStatesById(review.subgraphs),
      nativeEdges: reviewStatesById(review.nativeEdges),
      relationships: reviewStatesById(review.relationships),
    }),
    membershipChangedNodeIds: Object.freeze(membershipChangedNodeIds),
    membershipAffectedSubgraphIds: Object.freeze(membershipAffectedSubgraphIds),
  });
}

export type CanvasSystemRelationshipEndpointAliases = Partial<
  Record<'source' | 'target', string>
>;

/** A projected system relationship is never a GraphEdge or a routing endpoint. */
export type CanvasSystemRelationshipEdgeData = {
  relationship: NonNativeRelationship;
  projection: 'system-relationship';
  /** React Flow-only aliases for canonical node endpoints hidden by collapse. */
  endpointAliases?: CanvasSystemRelationshipEndpointAliases;
  /** Proposal visuals are review-only and never change canonical routing. */
  proposalState?: ProposalVisualState;
  /** Removed accepted records remain inspectable but never editable. */
  readOnly?: boolean;
  evidenceMarker?: number;
  onEvidenceActivate?: (relationshipId: string) => void;
  onRelationshipActivate?: (relationshipId: string) => void;
  /** Ephemeral proposal-detail focus; never serialized into the relationship. */
  reviewFocusState?: 'active' | 'dimmed';
  /** Selected-scenario state is ephemeral and never part of the relationship. */
  scenarioState?: ScenarioElementState;
  [key: string]: unknown;
};

export type CanvasSystemRelationshipEdge = Edge<
  CanvasSystemRelationshipEdgeData,
  'systemRelationship'
>;

export type CanvasFlowEdge = CanvasNativeEdge | CanvasSystemRelationshipEdge;

export type CanvasEdgePresentation = {
  /** The stored routing mode; loop remains a derived presentation only. */
  mode: GraphEdge['mode'];
  loop: boolean;
  invalid: boolean;
  frozen: boolean;
  proposalState?: ProposalVisualState | 'mixed';
  /** Runtime-only lines visually attach observed instances without becoming routes. */
  runtimeInstance?: boolean;
  /** Provenance changes the treatment, but never the native route semantics. */
  provenance: ProvenanceRepresentation;
  /** Selected-scenario state is ephemeral and never part of GraphEdge. */
  scenarioState?: ScenarioElementState;
};

export type EvidenceMarkerTarget = 'node' | 'edge' | 'relationship';

export type EvidenceMarker = {
  number: number;
  target: EvidenceMarkerTarget;
  id: string;
  label: string;
  provenance: Provenance;
  /** Explicit because only native edges participate in compiled routing. */
  nativeControlEdge: boolean;
};

export type CanvasProjectionMode = 'design' | 'runtime';
export type CanvasProjectionOptions = {
  mode?: CanvasProjectionMode;
  runtimeFixture?: RuntimeProjectionFixture | null;
  scenarioPresentation?: ScenarioPresentation | null;
};

export function isCanvasNativeEdge(edge: CanvasFlowEdge): edge is CanvasNativeEdge {
  return edge.type === 'routing' && edge.data?.projection !== 'system-relationship';
}

export function isCanvasSystemRelationshipEdge(
  edge: CanvasFlowEdge,
): edge is CanvasSystemRelationshipEdge {
  return edge.type === 'systemRelationship' && edge.data?.projection === 'system-relationship';
}

/**
 * Markers are deliberately assigned from stable canonical collections, not
 * render order or geometry. Only supplied evidence receives a marker.
 */
export function evidenceMarkersForGraph(graph: WorkflowGraph): EvidenceMarker[] {
  const candidates: Array<Omit<EvidenceMarker, 'number'>> = [
    ...graph.nodes
      .filter((node) => Boolean(node.provenance?.evidence))
      .map((node) => ({
        target: 'node' as const,
        id: node.id,
        label: node.label,
        provenance: node.provenance!,
        nativeControlEdge: false,
      })),
    ...graph.edges
      .filter((edge) => Boolean(edge.provenance?.evidence))
      .map((edge) => ({
        target: 'edge' as const,
        id: edge.id,
        label: edge.label?.trim() || `${edge.source} → ${edge.target}`,
        provenance: edge.provenance!,
        nativeControlEdge: true,
      })),
    ...graph.relationships
      .filter((relationship) => Boolean(relationship.provenance.evidence))
      .map((relationship) => ({
        target: 'relationship' as const,
        id: relationship.id,
        label: relationship.label?.trim() || relationship.kind,
        provenance: relationship.provenance,
        nativeControlEdge: false,
      })),
  ];
  return candidates
    .sort((left, right) =>
      `${left.target}:${left.id}`.localeCompare(`${right.target}:${right.id}`),
    )
    .map((marker, index) => ({ ...marker, number: index + 1 }));
}

type ProjectedDomainEdge = {
  edge: GraphEdge;
  source: string;
  target: string;
};

const proxyEdgeId = (source: string, target: string, semanticKey?: string) =>
  `subgraph-proxy:${encodeURIComponent(source)}:${encodeURIComponent(target)}${
    semanticKey ? `:${encodeURIComponent(semanticKey)}` : ''
  }`;

function proxyEdgeSemanticKey(
  edge: GraphEdge,
  loopEdgeIds: ReadonlySet<string>,
): string {
  return [
    edge.mode,
    loopEdgeIds.has(edge.id) ? 'loop' : 'route',
    edge.provenance?.representation ?? 'declared',
  ].join(':');
}

export function domainEdgeIdsForCanvasEdge(edge: CanvasFlowEdge): string[] {
  // React Flow permits an edge without data even when the projected edge type
  // is more specific. Treat that as an unselectable, non-domain edge rather
  // than letting a transient canvas edge break the editor.
  if (!isCanvasNativeEdge(edge)) return [];
  const domainEdgeIds = edge.data?.domainEdgeIds;
  return Array.isArray(domainEdgeIds)
    ? domainEdgeIds.filter((edgeId): edgeId is string => typeof edgeId === 'string')
    : [];
}

export function isSubgraphProxyEdge(edge: CanvasFlowEdge): boolean {
  return isCanvasNativeEdge(edge) && edge.data?.projection === 'subgraph-proxy';
}

/** A collapsed proxy is selected when any canonical edge it represents is selected. */
export function isCanvasEdgeSelected(
  edge: CanvasFlowEdge,
  selectedDomainEdgeIds: readonly string[],
): boolean {
  const selected = new Set(selectedDomainEdgeIds);
  return domainEdgeIdsForCanvasEdge(edge).some((edgeId) => selected.has(edgeId));
}

/** Only a visible canonical graph node may be used for a new domain edge. */
export function isConnectableDomainEndpoint(
  node: CanvasFlowNode | undefined,
): boolean {
  return (node?.type === 'contractNode' || node?.type === 'mergeJunction') && !node.hidden;
}

export function canConnectCanvasEndpoints(
  nodes: CanvasFlowNode[],
  source: string | null | undefined,
  target: string | null | undefined,
): boolean {
  return Boolean(
    source &&
      target &&
      isConnectableDomainEndpoint(nodes.find((node) => node.id === source)) &&
      isConnectableDomainEndpoint(nodes.find((node) => node.id === target)),
  );
}

/** Proxies stand for several or hidden canonical edges and are never reconnectable. */
export function canReconnectCanvasEdge(edge: CanvasFlowEdge): boolean {
  return isCanvasNativeEdge(edge) && edge.data?.projection === 'domain' && domainEdgeIdsForCanvasEdge(edge).length === 1;
}

function proposalVisualState(
  state: CanvasReviewState | undefined,
): ProposalVisualState | undefined {
  return state === 'unchanged' ? undefined : state;
}

function aggregateReviewStates(
  states: readonly CanvasReviewState[],
): CanvasReviewAggregate {
  if (states.length === 0) return 'unchanged';
  return new Set(states).size === 1 ? states[0] : 'mixed';
}

function reviewProjectionForEdges(
  edges: readonly GraphEdge[],
  states: Readonly<Record<string, CanvasReviewState>>,
): CanvasEdgeReviewProjection {
  const entries = edges
    .map((edge) => [edge.id, states[edge.id] ?? 'unchanged'] as const)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
  return {
    aggregate: aggregateReviewStates(entries.map(([, state]) => state)),
    byDomainEdgeId: Object.fromEntries(entries),
  };
}

function isEdgeInvalid(
  edge: GraphEdge,
  graph: WorkflowGraph,
  validationIssues: ReturnType<typeof validateGraph>,
): boolean {
  // Some validation errors belong to the route itself, while count/mixing
  // errors belong to its source node. Keep both observable on the canvas.
  const routePath = `edges.${edge.id}`;
  const sourcePath = `nodes.${edge.source}`;
  const validationMarksEdge = validationIssues.some(
    (issue) =>
      issue.path === routePath ||
      issue.path?.startsWith(`${routePath}.`) ||
      issue.path === sourcePath,
  );
  const routeLabelMissing =
    (edge.mode === 'conditional' || edge.mode === 'command') && !edge.label?.trim();
  const unreadableCondition =
    (edge.mode === 'conditional' || edge.mode === 'command') &&
    edge.condition !== undefined &&
    !edge.condition.trim();

  // A frozen graph is separately presented as locked, not invalid.
  return graph.status !== 'frozen' && (validationMarksEdge || routeLabelMissing || unreadableCondition);
}

/** Source-scoped domain issues stay visible on the owning Step shell. */
function isNodeInvalid(
  nodeId: string,
  graph: WorkflowGraph,
  validationIssues: ReturnType<typeof validateGraph>,
): boolean {
  if (graph.status === 'frozen') return false;
  const nodePath = `nodes.${nodeId}`;
  return validationIssues.some(
    (issue) => issue.path === nodePath || issue.path?.startsWith(`${nodePath}.`),
  );
}

/**
 * A loop is a start-reachable depth-first back edge. The canonical sorted
 * traversal deliberately matches scenario enumeration, so changing a canvas
 * layout or collapsing a subgraph cannot change its presentation.
 */
export function topologyDerivedLoopEdgeIds(graph: WorkflowGraph): Set<string> {
  const start = graph.nodes.find((node) => node.kind === 'start' && !node.parentId);
  if (!start) return new Set();

  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  for (const edges of outgoing.values()) {
    edges.sort((a, b) =>
      [a.source, a.target, a.mode, a.label ?? '', a.condition ?? '', a.id]
        .join('\u0000')
        .localeCompare([b.source, b.target, b.mode, b.label ?? '', b.condition ?? '', b.id].join('\u0000')),
    );
  }

  const loopEdgeIds = new Set<string>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const findLoopEdges = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (visiting.has(edge.target)) loopEdgeIds.add(edge.id);
      else findLoopEdges(edge.target);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  findLoopEdges(start.id);
  return loopEdgeIds;
}

function projectEdge(
  { edge, source, target }: ProjectedDomainEdge,
  reconnectable: boolean,
  domainEdgeIds: string[],
  projection: CanvasEdgeData['projection'],
  presentation: CanvasEdgePresentation,
  review: CanvasEdgeReviewProjection = {
    aggregate: 'unchanged',
    byDomainEdgeId: {},
  },
  proxySemanticKey?: string,
): CanvasNativeEdge {
  const rendered = resolveRoutingEdgePresentation(presentation);
  return {
    id:
      projection === 'subgraph-proxy'
        ? proxyEdgeId(source, target, proxySemanticKey)
        : projection === 'runtime-instance'
          ? `runtime-projection:${encodeURIComponent(edge.id)}:${encodeURIComponent(source)}:${encodeURIComponent(target)}`
          : edge.id,
    type: 'routing',
    className: [
      `contract-edge contract-edge--${presentation.mode}`,
      scenarioPresentationClassName(presentation.scenarioState),
    ].filter(Boolean).join(' '),
    source,
    target,
    sourceHandle: CANVAS_OUTPUT_PORT_ID,
    targetHandle: CANVAS_INPUT_PORT_ID,
    label: resolveRoutingEdgeLabel(edge, presentation),
    markerEnd: { type: MarkerType.ArrowClosed, color: rendered.color },
    animated: rendered.animated,
    reconnectable: projection === 'domain' && reconnectable && !presentation.frozen,
    interactionWidth: 28,
    pathOptions: { borderRadius: 16, offset: 28 },
    style: {
      stroke: rendered.color,
      strokeWidth: rendered.strokeWidth,
      strokeDasharray: rendered.dasharray,
      opacity: rendered.opacity,
    },
    labelStyle: { fill: '#303a35', fontSize: 11, fontWeight: 720 },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
    labelBgPadding: [5, 3] as [number, number],
    labelBgBorderRadius: 6,
    data: { edge, domainEdgeIds, projection, presentation, review },
  };
}

function subgraphFlowNode(
  subgraph: GraphSubgraph,
  graph: WorkflowGraph,
  proposalState?: ProposalVisualState,
  scenarioState?: ScenarioElementState,
  descendantReviewState?: CanvasReviewAggregate,
): CanvasFlowNode {
  const subgraphsById = new Map(graph.subgraphs.map((candidate) => [candidate.id, candidate]));
  const parent = subgraph.parentId ? subgraphsById.get(subgraph.parentId) : undefined;
  const dimensions = canvasNodeRenderer('subgraph').dimensions;
  const width = subgraph.collapsed ? dimensions.width : subgraph.dimensions.width;
  const height = subgraph.collapsed ? dimensions.height : subgraph.dimensions.height;
  const removed = proposalState === 'removed';
  return {
    id: subgraph.id,
    type: 'subgraph',
    className: scenarioPresentationClassName(scenarioState),
    position: subgraph.position,
    ...(parent
      ? {
          parentId: parent.id,
          extent: 'parent' as const,
          expandParent: false,
          hidden: Boolean(outermostCollapsedSubgraphId(parent.id, subgraphsById)),
        }
      : {}),
    // Expanded containers sit directly below their member nodes. Their
    // component supplies a transparent body drag surface below those member
    // wrappers, plus the visible header. Controls opt out with `nodrag`.
    zIndex: removed ? -1 : subgraph.collapsed ? 10 : parent ? 1 : 0,
    width,
    height,
    initialWidth: width,
    initialHeight: height,
    style: { width, height },
    selectable: !removed,
    draggable: !removed,
    dragHandle: '.subgraph-node-drag-surface',
    focusable: !removed,
    connectable: false,
    ariaLabel: `${subgraph.label} subgraph, ${proposalState ? `proposed ${proposalState}, ` : ''}${subgraph.collapsed ? 'collapsed' : 'expanded'}`,
    data: {
      ...subgraph,
      proposalState,
      durability: resolveEffectiveCapabilities(graph, subgraph.id),
      scenarioState,
      descendantReviewState,
    },
  };
}

/** Projection only: a container can visually surround an unparented node
 * without acquiring membership. Make that discrepancy explicit rather than
 * silently changing canonical parentId. */
function isUnparentedNodeInsideExpandedSubgraph(
  node: WorkflowGraph['nodes'][number],
  subgraphs: readonly GraphSubgraph[],
): boolean {
  if (node.parentId) return false;
  const subgraphsById = new Map(subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const centre = {
    x: node.position.x + canvasNodeRenderer('contractNode').dimensions.width / 2,
    y: node.position.y + canvasNodeRenderer('contractNode').dimensions.height / 2,
  };
  return subgraphs.some((subgraph) => {
    if (subgraph.collapsed) return false;
    const position = absoluteSubgraphPosition(subgraph, subgraphsById);
    return centre.x > position.x + SUBGRAPH_BODY_INSET &&
      centre.x < position.x + subgraph.dimensions.width - SUBGRAPH_BODY_INSET &&
      centre.y > position.y + SUBGRAPH_HEADER_HEIGHT &&
      centre.y < position.y + subgraph.dimensions.height - SUBGRAPH_BODY_INSET;
  });
}

function absolutePosition(
  node: GraphNode,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
) {
  const position = { ...node.position };
  const visited = new Set<string>();
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = subgraphsById.get(parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}

function absoluteSubgraphPosition(
  subgraph: GraphSubgraph,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
) {
  const position = { ...subgraph.position };
  const visited = new Set([subgraph.id]);
  let parentId = subgraph.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = subgraphsById.get(parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}

/** The outermost collapsed ancestor is the only visible boundary for any
 * deeply contained endpoint. Returning the nearest collapsed child would
 * target a React Flow node that is itself hidden by its parent. */
function outermostCollapsedSubgraphId(
  parentId: string | undefined,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
): string | undefined {
  const visited = new Set<string>();
  let currentId = parentId;
  let collapsedId: string | undefined;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const current = subgraphsById.get(currentId);
    if (!current) break;
    if (current.collapsed) collapsedId = current.id;
    currentId = current.parentId;
  }
  return collapsedId;
}

function subgraphDepth(
  subgraph: GraphSubgraph,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
): number {
  let depth = 0;
  const visited = new Set<string>();
  let parentId = subgraph.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = subgraphsById.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

function descendantReviewStateForSubgraph(
  accepted: WorkflowGraph,
  preview: WorkflowGraph,
  subgraphId: string,
  review: Extract<CanvasReviewProjection, { kind: 'comparable' }> | null,
): CanvasReviewAggregate {
  if (!review) return 'unchanged';

  const descendantNodeIds = new Set(
    [...accepted.nodes, ...preview.nodes]
      .filter((node) => node.parentId === subgraphId)
      .map((node) => node.id),
  );
  const states: ProposalVisualState[] = [];
  for (const nodeId of [...descendantNodeIds].sort()) {
    const state = proposalVisualState(review.states.nodes[nodeId]);
    if (state) states.push(state);
  }

  const changedEdgeIds = Object.keys(review.states.nativeEdges).filter(
    (edgeId) => review.states.nativeEdges[edgeId] !== 'unchanged',
  );
  for (const edgeId of [...changedEdgeIds].sort()) {
    const touchesDescendant = [...accepted.edges, ...preview.edges].some(
      (edge) =>
        edge.id === edgeId &&
        (descendantNodeIds.has(edge.source) || descendantNodeIds.has(edge.target)),
    );
    const state = proposalVisualState(review.states.nativeEdges[edgeId]);
    if (touchesDescendant && state) states.push(state);
  }

  const changedRelationshipIds = Object.keys(review.states.relationships).filter(
    (relationshipId) => review.states.relationships[relationshipId] !== 'unchanged',
  );
  for (const relationshipId of [...changedRelationshipIds].sort()) {
    const touchesDescendant = [
      ...(accepted.relationships ?? []),
      ...(preview.relationships ?? []),
    ].some(
      (relationship) =>
        relationship.id === relationshipId &&
        [relationship.source, relationship.target].some(
          (endpoint) => endpoint.kind === 'node' && descendantNodeIds.has(endpoint.nodeId),
        ),
    );
    const state = proposalVisualState(review.states.relationships[relationshipId]);
    if (touchesDescendant && state) states.push(state);
  }

  return aggregateReviewStates(states);
}

function sendTemplateData(
  node: GraphNode,
  edges: readonly GraphEdge[],
) {
  if (node.kind !== 'step') return undefined;
  const send = edges
    .filter((edge) => edge.mode === 'send' && edge.target === node.id)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!send) return undefined;
  return {
    edgeId: send.id,
    payloadLabel: send.send?.payloadLabel ?? '',
    mergeNodeId: send.send?.mergeNodeId ?? '',
  };
}

function dynamicWorkerGroupNodes(
  graph: WorkflowGraph,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
  runtimeHiddenNodeIds: ReadonlySet<string>,
  scenarioPresentation: ScenarioPresentation | null,
): CanvasFlowNode[] {
  return graph.edges.flatMap((edge) => {
    // A derived worker-group exists only when the contract explicitly carries
    // render-only template anatomy. Ordinary Send edges—including Sends inside
    // a real nested subgraph—must keep their canonical Step and container UI.
    if (edge.mode !== 'send' || !edge.send?.templateAnatomy) return [];
    const source = graph.nodes.find((node) => node.id === edge.source);
    const template = graph.nodes.find((node) => node.id === edge.target);
    const merge = graph.nodes.find((node) => node.id === edge.send!.mergeNodeId);
    const parentId = template?.parentId;
    const parent = parentId ? subgraphsById.get(parentId) : undefined;
    if (
      !source ||
      !template ||
      !merge ||
      !parent ||
      source.parentId !== parentId ||
      merge.parentId !== parentId
    ) {
      return [];
    }

    const anatomy = edge.send.templateAnatomy;
    const canonicalAnatomyNode = anatomy?.nodes.find(
      (candidate) => candidate.id === anatomy.canonicalTemplateNodeId,
    );
    const memberNodeIds = anatomy?.nodes.map((candidate) => candidate.id) ?? [template.id];
    const memberEdgeIds = anatomy?.edges.map((candidate) => candidate.id) ?? [];
    const width = anatomy?.dimensions.width ?? DYNAMIC_WORKER_GROUP_MIN_WIDTH;
    const height = anatomy?.dimensions.height ?? DYNAMIC_WORKER_GROUP_MIN_HEIGHT;
    const position = canonicalAnatomyNode
      ? {
          x: template.position.x - canonicalAnatomyNode.position.x,
          y: template.position.y - canonicalAnatomyNode.position.y,
        }
      : {
          x: template.position.x - DYNAMIC_WORKER_GROUP_INSET_X,
          y: template.position.y - DYNAMIC_WORKER_GROUP_INSET_Y,
        };

    return [{
      id: `dynamic-worker-group:${edge.id}`,
      type: 'dynamicWorkerGroup' as const,
      parentId,
      extent: 'parent' as const,
      expandParent: false,
      position,
      width,
      height,
      initialWidth: width,
      initialHeight: height,
      // React Flow enables pointer events on every wrapper when the workspace
      // supplies a shared onNodeClick handler. This derived, non-selectable
      // frame must stay transparent so empty space belongs to its canonical
      // parent subgraph; its explicit header opts back in from component CSS.
      style: { width, height, pointerEvents: 'none' },
      hidden: parent.collapsed || runtimeHiddenNodeIds.has(template.id),
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: true,
      zIndex: 0,
      className: scenarioPresentationClassName(
        scenarioElementState(
          scenarioPresentation,
          Boolean(scenarioPresentation?.activeNodeIds.has(template.id)),
        ),
      ),
      ariaLabel: `Researcher ×N, declared dynamic subgraph template with ${memberNodeIds.length} steps and ${memberEdgeIds.length} connections`,
      data: {
        label: 'Researcher ×N',
        sendEdgeId: edge.id,
        templateNodeId: template.id,
        memberNodeIds,
        memberEdgeIds,
        mergeNodeId: merge.id,
        payloadLabel: edge.send.payloadLabel,
        templateAnatomy: anatomy,
      },
    }];
  });
}

function projectDomainNode(
  node: GraphNode,
  preview: WorkflowGraph,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
  reviewStates: Readonly<Record<string, CanvasReviewState>>,
  validationIssues: ReturnType<typeof validateGraph>,
  runtimeHiddenNodeIds: ReadonlySet<string>,
  scenarioState?: ScenarioElementState,
): CanvasFlowNode {
  const proposalState = proposalVisualState(reviewStates[node.id]);
  const outsideSubgraph =
    proposalState !== 'removed' && isUnparentedNodeInsideExpandedSubgraph(node, preview.subgraphs);
  const parentProperties = node.parentId
    ? {
        parentId: node.parentId,
        extent: 'parent' as const,
        expandParent: false,
        zIndex: 1,
      }
    : {};
  const invalid = isNodeInvalid(node.id, preview, validationIssues);
  const frozen = preview.status === 'frozen';
  const hidden = Boolean(outermostCollapsedSubgraphId(node.parentId, subgraphsById))
    || runtimeHiddenNodeIds.has(node.id);

  if (node.kind === 'merge') {
    const dimensions = canvasNodeRenderer('mergeJunction').dimensions;
    return {
      id: node.id,
      type: 'mergeJunction',
      className: scenarioPresentationClassName(scenarioState),
      position: node.position,
      initialWidth: dimensions.width,
      initialHeight: dimensions.height,
      hidden,
      selectable: proposalState !== 'removed',
      draggable: proposalState !== 'removed',
      focusable: proposalState !== 'removed',
      ariaLabel: `${node.label} Merge junction, reducer ${node.merge.reducer.name || 'unset'}, ${
        node.merge.waitingForDynamicInputs ? 'waiting for dynamic inputs' : 'invalid waiting policy'
      }${invalid ? ', invalid' : ''}`,
      ...parentProperties,
      data: { ...node, proposalState, invalid, frozen, outsideSubgraph, scenarioState },
    };
  }

  const template = sendTemplateData(node, preview.edges);
  const dimensions = canvasNodeRenderer('contractNode').dimensions;
  return {
    id: node.id,
    type: 'contractNode',
    className: scenarioPresentationClassName(scenarioState),
    position: node.position,
    initialWidth: dimensions.width,
    initialHeight: dimensions.height,
    hidden,
    selectable: proposalState !== 'removed',
    draggable: proposalState !== 'removed',
    focusable: proposalState !== 'removed',
    ariaLabel: `${node.label} ${node.kind}${template ? ', dynamic worker template ×N' : ''}${
      invalid ? ', invalid' : ''
    }`,
    ...parentProperties,
    data: {
      ...node,
      proposalState,
      outsideSubgraph,
      invalid,
      frozen,
      scenarioState,
      ...(template ? { sendTemplate: template } : {}),
    },
  };
}

export function projectGraphToCanvas(
  graph: WorkflowGraph,
  reviewProjection: CanvasReviewProjection | null,
  options: CanvasProjectionOptions = {},
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const accepted = reviewProjection?.accepted ?? graph;
  const comparableReview = reviewProjection?.kind === 'comparable'
    ? reviewProjection
    : null;
  const preview = comparableReview?.candidate ?? accepted;
  const runtime =
    options.mode === 'runtime' && !reviewProjection
      ? runtimeProjectionAvailability(accepted, options.runtimeFixture)
      : null;
  const runtimeTemplateNodeIds = new Set(
    runtime?.available ? runtime.fixture.instances.map((instance) => instance.templateNodeId) : [],
  );
  const runtimeReplacedEdgeIds = new Set<string>();
  if (runtime?.available) {
    for (const instance of runtime.fixture.instances) {
      const send = preview.edges.find((edge) => edge.id === instance.sendEdgeId);
      if (!send || send.mode !== 'send' || !send.send) continue;
      runtimeReplacedEdgeIds.add(send.id);
      for (const candidate of preview.edges) {
        if (
          candidate.mode === 'normal' &&
          candidate.source === send.target &&
          candidate.target === send.send.mergeNodeId
        ) {
          runtimeReplacedEdgeIds.add(candidate.id);
        }
      }
    }
  }
  const scenarioPresentation = options.scenarioPresentation ?? null;
  const membershipAffectedSubgraphs = new Set(
    comparableReview?.membershipAffectedSubgraphIds ?? [],
  );
  const nodeReviewStates = comparableReview?.states.nodes ?? {};
  const subgraphReviewStates = comparableReview?.states.subgraphs ?? {};
  const edgeReviewStates = comparableReview?.states.nativeEdges ?? {};
  const relationshipReviewStates = comparableReview?.states.relationships ?? {};
  const subgraphReviewProjection = (subgraph: GraphSubgraph) => {
    let proposalState = proposalVisualState(subgraphReviewStates[subgraph.id]);
    if (!proposalState && membershipAffectedSubgraphs.has(subgraph.id)) {
      proposalState = 'updated';
    }
    const descendantReviewState = subgraph.collapsed
      ? descendantReviewStateForSubgraph(accepted, preview, subgraph.id, comparableReview)
      : undefined;
    return {
      proposalState:
        proposalState ??
        (descendantReviewState && descendantReviewState !== 'unchanged' ? 'updated' : undefined),
      descendantReviewState,
    };
  };

  // Candidate containers drive membership and edge projection. Base-only
  // containers are review ghosts for dissolves and never become parents or
  // proxy endpoints.
  const previewSubgraphIds = new Set(preview.subgraphs.map((subgraph) => subgraph.id));
  const sourceSubgraphs = [
    ...preview.subgraphs,
    ...accepted.subgraphs.filter((subgraph) => !previewSubgraphIds.has(subgraph.id)),
  ];

  // The candidate graph is the authoritative preview. Keep deleted accepted
  // elements as ghosts so the existing review UI can show removals, but never
  // reconstruct active candidate nodes from individual operation patches.
  const previewNodeIds = new Set(preview.nodes.map((node) => node.id));
  const sourceNodes = [
    ...preview.nodes,
    ...accepted.nodes.filter((node) => !previewNodeIds.has(node.id)),
  ];
  const nodeScenarioState = (nodeId: string) =>
    scenarioElementState(
      scenarioPresentation,
      Boolean(scenarioPresentation?.activeNodeIds.has(nodeId)),
    );
  const subgraphsById = new Map(preview.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const isWithinSubgraph = (node: GraphNode, subgraphId: string) => {
    const visited = new Set<string>();
    let parentId = node.parentId;
    while (parentId && !visited.has(parentId)) {
      if (parentId === subgraphId) return true;
      visited.add(parentId);
      parentId = subgraphsById.get(parentId)?.parentId;
    }
    return false;
  };
  const subgraphScenarioState = (subgraphId: string) =>
    scenarioElementState(
      scenarioPresentation,
      sourceNodes.some(
        (node) => isWithinSubgraph(node, subgraphId) && scenarioPresentation?.activeNodeIds.has(node.id),
      ),
    );

  const validationIssues = validateGraph(preview);
  const dynamicWorkerGroups = dynamicWorkerGroupNodes(
    preview,
    subgraphsById,
    runtimeTemplateNodeIds,
    scenarioPresentation,
  );
  const nodes: CanvasFlowNode[] = [
    ...sourceSubgraphs
      .toSorted((left, right) =>
        subgraphDepth(left, subgraphsById) - subgraphDepth(right, subgraphsById)
        || left.id.localeCompare(right.id),
      )
      .map((subgraph) => {
      const review = subgraphReviewProjection(subgraph);
      return subgraphFlowNode(
        subgraph,
        preview,
        review.proposalState,
        subgraphScenarioState(subgraph.id),
        review.descendantReviewState,
      );
    }),
    ...dynamicWorkerGroups,
    ...sourceNodes.map((node) =>
      projectDomainNode(
        node,
        preview,
        subgraphsById,
        nodeReviewStates,
        validationIssues,
        runtimeTemplateNodeIds,
        nodeScenarioState(node.id),
      ),
    ),
  ];

  const previewEdgeIds = new Set(preview.edges.map((edge) => edge.id));
  const sourceEdges = [
    ...preview.edges,
    ...accepted.edges.filter((edge) => !previewEdgeIds.has(edge.id)),
  ].filter((edge) => !runtimeReplacedEdgeIds.has(edge.id));
  const loopEdgeIds = topologyDerivedLoopEdgeIds({ ...preview, edges: sourceEdges });
  const dynamicGroupBySendEdgeId = new Map(
    preview.edges.flatMap((edge) => (
      edge.mode === 'send' && edge.send.templateAnatomy
        ? [[edge.id, `dynamic-worker-group:${edge.id}`] as const]
        : []
    )),
  );
  const dynamicGroupByTemplateContinuationId = new Map(
    preview.edges.flatMap((sendEdge) => {
      if (sendEdge.mode !== 'send' || !sendEdge.send.templateAnatomy) return [];
      const continuation = preview.edges.find((candidate) => (
        candidate.mode === 'normal'
        && candidate.source === sendEdge.target
        && candidate.target === sendEdge.send.mergeNodeId
      ));
      return continuation
        ? [[continuation.id, `dynamic-worker-group:${sendEdge.id}`] as const]
        : [];
    }),
  );
  const visibleNodeEndpoint = (nodeId: string) => {
    const node = preview.nodes.find((candidate) => candidate.id === nodeId);
    return outermostCollapsedSubgraphId(node?.parentId, subgraphsById) ?? nodeId;
  };
  const domainEdges: ProjectedDomainEdge[] = sourceEdges.map((edge) => {
    return {
      edge,
      source: visibleNodeEndpoint(edge.source) !== edge.source
        ? visibleNodeEndpoint(edge.source)
        : dynamicGroupByTemplateContinuationId.get(edge.id) ?? edge.source,
      target: visibleNodeEndpoint(edge.target) !== edge.target
        ? visibleNodeEndpoint(edge.target)
        : dynamicGroupBySendEdgeId.get(edge.id) ?? edge.target,
    };
  });

  const proxyEdges = new Map<string, {
    endpointKey: string;
    semanticKey: string;
    edges: ProjectedDomainEdge[];
  }>();
  const edges: CanvasFlowEdge[] = [];
  const canvasEdgesReconnectable = accepted.status === 'draft' && !reviewProjection;
  const edgePresentation = (
    edge: GraphEdge,
    group: readonly GraphEdge[] = [edge],
    review: CanvasEdgeReviewProjection = reviewProjectionForEdges(group, edgeReviewStates),
  ): CanvasEdgePresentation => ({
    mode: edge.mode,
    loop: group.some((candidate) => loopEdgeIds.has(candidate.id)),
    invalid: group.some((candidate) => isEdgeInvalid(candidate, preview, validationIssues)),
    frozen: accepted.status === 'frozen',
    proposalState: review.aggregate === 'unchanged' ? undefined : review.aggregate,
    provenance: edge.provenance?.representation ?? 'declared',
    scenarioState: scenarioElementState(
      scenarioPresentation,
      group.some((candidate) => scenarioPresentation?.activeEdgeIds.has(candidate.id)),
    ),
  });
  for (const domainEdge of domainEdges) {
    const collapsedInternal =
      domainEdge.source === domainEdge.target && domainEdge.source !== domainEdge.edge.source;
    if (collapsedInternal) continue;

    const isTemplateBoundary =
      domainEdge.source.startsWith('dynamic-worker-group:') ||
      domainEdge.target.startsWith('dynamic-worker-group:');
    if (isTemplateBoundary) {
      const group = [domainEdge.edge];
      const review = reviewProjectionForEdges(group, edgeReviewStates);
      edges.push(
        projectEdge(
          domainEdge,
          false,
          [domainEdge.edge.id],
          'template-boundary',
          edgePresentation(domainEdge.edge, group, review),
          review,
        ),
      );
      continue;
    }

    const isProxy =
      domainEdge.source !== domainEdge.edge.source || domainEdge.target !== domainEdge.edge.target;
    if (!isProxy) {
      const group = [domainEdge.edge];
      const review = reviewProjectionForEdges(group, edgeReviewStates);
      edges.push(
        projectEdge(
          domainEdge,
          canvasEdgesReconnectable,
          [domainEdge.edge.id],
          'domain',
          edgePresentation(domainEdge.edge, group, review),
          review,
        ),
      );
      continue;
    }

    const endpointKey = `${domainEdge.source}\u0000${domainEdge.target}`;
    const semanticKey = proxyEdgeSemanticKey(domainEdge.edge, loopEdgeIds);
    const key = `${endpointKey}\u0000${semanticKey}`;
    const existing = proxyEdges.get(key);
    proxyEdges.set(key, {
      endpointKey,
      semanticKey,
      edges: [...(existing?.edges ?? []), domainEdge],
    });
  }

  const proxyGroups = [...proxyEdges.values()]
    .map((group) => ({
      ...group,
      edges: [...group.edges].sort((left, right) => left.edge.id.localeCompare(right.edge.id)),
    }))
    .sort((left, right) =>
      left.edges[0].edge.id.localeCompare(right.edges[0].edge.id) ||
      left.endpointKey.localeCompare(right.endpointKey) ||
      left.semanticKey.localeCompare(right.semanticKey),
    );
  const semanticGroupCountByEndpoint = new Map<string, number>();
  for (const group of proxyGroups) {
    semanticGroupCountByEndpoint.set(
      group.endpointKey,
      (semanticGroupCountByEndpoint.get(group.endpointKey) ?? 0) + 1,
    );
  }

  for (const { endpointKey, semanticKey, edges: groupedEdges } of proxyGroups) {
    const [first] = groupedEdges;
    const group = groupedEdges.map(({ edge }) => edge);
    const review = reviewProjectionForEdges(group, edgeReviewStates);
    edges.push(
      projectEdge(
        first,
        false,
        group.map((edge) => edge.id),
        'subgraph-proxy',
        edgePresentation(first.edge, group, review),
        review,
        semanticGroupCountByEndpoint.get(endpointKey) === 1 ? undefined : semanticKey,
      ),
    );
  }

  // Runtime evidence can only add ephemeral canvas elements. It never changes
  // the accepted graph, proposal diff, selection store, or persisted layout.
  if (runtime?.available) {
    const visibleEndpoint = (nodeId: string) => {
      const node = preview.nodes.find((candidate) => candidate.id === nodeId);
      return outermostCollapsedSubgraphId(node?.parentId, subgraphsById) ?? nodeId;
    };
    const instancesByTemplate = new Map<string, typeof runtime.fixture.instances>();
    for (const instance of runtime.fixture.instances) {
      instancesByTemplate.set(instance.templateNodeId, [
        ...(instancesByTemplate.get(instance.templateNodeId) ?? []),
        instance,
      ]);
    }
    const instanceOffsetByTemplate = new Map<string, number>();
    for (const instance of [...runtime.fixture.instances].sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      const send = preview.edges.find((edge) => edge.id === instance.sendEdgeId);
      const template = preview.nodes.find((node) => node.id === instance.templateNodeId);
      if (!send || !template || send.mode !== 'send' || !send.send) continue;

      const offset = instanceOffsetByTemplate.get(template.id) ?? 0;
      instanceOffsetByTemplate.set(template.id, offset + 1);
      const templatePosition = absolutePosition(template, subgraphsById);
      const templateInstances = instancesByTemplate.get(template.id) ?? [];
      const runtimeNodeId = `runtime:${instance.id}`;
      const templateLabel = template.label || template.id;
      const mergeId = send.send.mergeNodeId;
      nodes.push({
        id: runtimeNodeId,
        type: 'runtimeInstance',
        position: {
          x: templatePosition.x,
          y:
            templatePosition.y +
            offset * (RUNTIME_INSTANCE_HEIGHT + RUNTIME_INSTANCE_VERTICAL_GAP) -
            ((templateInstances.length - 1) * (RUNTIME_INSTANCE_HEIGHT + RUNTIME_INSTANCE_VERTICAL_GAP)) / 2,
        },
        width: RUNTIME_INSTANCE_WIDTH,
        height: RUNTIME_INSTANCE_HEIGHT,
        initialWidth: RUNTIME_INSTANCE_WIDTH,
        initialHeight: RUNTIME_INSTANCE_HEIGHT,
        selectable: true,
        draggable: false,
        connectable: false,
        deletable: false,
        focusable: true,
        ariaLabel: `Observed runtime instance ${instance.ordinal}: ${
          instance.label?.trim() || templateLabel
        }. Read-only projection of template ${templateLabel}.`,
        data: {
          runtimeId: instance.id,
          sendEdgeId: send.id,
          templateNodeId: template.id,
          label: instance.label?.trim() || `${templateLabel} #${instance.ordinal}`,
          ordinal: instance.ordinal,
        },
      });
      edges.push(
        projectEdge(
          {
            edge: send,
            source: visibleEndpoint(send.source),
            target: runtimeNodeId,
          },
          false,
          [],
          'runtime-instance',
          {
            mode: 'send',
            loop: false,
            invalid: false,
            frozen: true,
            runtimeInstance: true,
            provenance: 'runtime-generated',
          },
        ),
      );
      const runtimeConnector: GraphEdge = {
        id: `runtime-connector:${instance.id}`,
        source: runtimeNodeId,
        target: visibleEndpoint(mergeId),
        mode: 'normal',
      };
      edges.push(
        projectEdge(
          {
            edge: runtimeConnector,
            source: runtimeNodeId,
            target: visibleEndpoint(mergeId),
          },
          false,
          [],
          'runtime-instance',
          {
            mode: 'normal',
            loop: false,
            invalid: false,
            frozen: true,
            runtimeInstance: true,
            provenance: 'runtime-generated',
          },
        ),
      );
    }
  }

  // Relationships intentionally bypass every native-edge branch above. A
  // hidden child endpoint may alias its collapsed card in React Flow, but the
  // relationship payload remains canonical and never gains domain-edge IDs,
  // reachability, or a reconnection/delete affordance. External tiles exist
  // only in this canvas projection and are deterministically positioned from
  // their node endpoint.
  const externalTileIds = new Set<string>();
  const externalTileWidth = canvasNodeRenderer('externalSystemTile').dimensions.width;
  const externalTileHeight = canvasNodeRenderer('externalSystemTile').dimensions.height;
  const externalTileGap = 168;
  const relationshipEndpointId = (endpoint: NonNativeRelationship['source']) =>
    endpoint.kind === 'node'
      ? endpoint.nodeId
      : `external-system:${encodeURIComponent(endpoint.externalId)}`;
  const visibleRelationshipEndpointId = (endpoint: NonNativeRelationship['source']) => {
    if (endpoint.kind === 'external') return relationshipEndpointId(endpoint);
    const node = sourceNodes.find((candidate) => candidate.id === endpoint.nodeId);
    return outermostCollapsedSubgraphId(node?.parentId, subgraphsById) ?? endpoint.nodeId;
  };
  // Candidate relationships are authoritative during review. Base-only
  // records are retained strictly as removed ghosts; selection can still
  // inspect those accepted records, but no relationship ever becomes native.
  const previewRelationships = preview.relationships ?? [];
  const acceptedRelationships = accepted.relationships ?? [];
  const previewRelationshipIds = new Set(previewRelationships.map((relationship) => relationship.id));
  const systemRelationships = [
    ...previewRelationships,
    ...acceptedRelationships.filter((relationship) => !previewRelationshipIds.has(relationship.id)),
  ].sort((left, right) => left.id.localeCompare(right.id));
  for (const relationship of systemRelationships) {
    const proposalState = proposalVisualState(relationshipReviewStates[relationship.id]);
    const externalEndpoint = relationship.source.kind === 'external'
      ? relationship.source
      : relationship.target.kind === 'external'
        ? relationship.target
        : null;
    const nodeEndpoint = relationship.source.kind === 'node'
      ? relationship.source
      : relationship.target.kind === 'node'
        ? relationship.target
        : null;
    if (!externalEndpoint || !nodeEndpoint) continue;

    const tileId = relationshipEndpointId(externalEndpoint);
    if (!externalTileIds.has(tileId)) {
      externalTileIds.add(tileId);
      const anchor = sourceNodes.find((node) => node.id === nodeEndpoint.nodeId);
      const collapsedAnchorId = outermostCollapsedSubgraphId(anchor?.parentId, subgraphsById);
      const collapsedAnchor = collapsedAnchorId ? subgraphsById.get(collapsedAnchorId) : undefined;
      const anchorPosition = collapsedAnchor
        ? absoluteSubgraphPosition(collapsedAnchor, subgraphsById)
        : anchor
          ? absolutePosition(anchor, subgraphsById)
          : { x: 0, y: 0 };
      const externalIsSource = relationship.source.kind === 'external';
      nodes.push({
        id: tileId,
        type: 'externalSystemTile',
        className: scenarioPresentationClassName(scenarioElementState(
          scenarioPresentation,
          Boolean(scenarioPresentation?.activeExternalSystemIds.has(externalEndpoint.externalId)),
        )),
        position: {
          x: externalIsSource
            ? Math.max(12, anchorPosition.x - externalTileWidth - externalTileGap)
            : anchorPosition.x + canvasNodeRenderer('contractNode').dimensions.width + externalTileGap,
          y: Math.max(12, anchorPosition.y + (canvasNodeRenderer('contractNode').dimensions.height - externalTileHeight) / 2),
        },
        width: externalTileWidth,
        height: externalTileHeight,
        initialWidth: externalTileWidth,
        initialHeight: externalTileHeight,
        selectable: false,
        draggable: false,
        connectable: false,
        deletable: false,
        focusable: false,
        ariaLabel: `External system ${externalEndpoint.label}. Projection-only boundary tile.`,
        data: {
          externalId: externalEndpoint.externalId,
          label: externalEndpoint.label,
          scenarioState: scenarioElementState(
            scenarioPresentation,
            Boolean(scenarioPresentation?.activeExternalSystemIds.has(externalEndpoint.externalId)),
          ),
        },
      });
    }
    const canonicalSource = relationshipEndpointId(relationship.source);
    const canonicalTarget = relationshipEndpointId(relationship.target);
    const source = visibleRelationshipEndpointId(relationship.source);
    const target = visibleRelationshipEndpointId(relationship.target);
    const endpointAliases: CanvasSystemRelationshipEndpointAliases = {
      ...(source !== canonicalSource ? { source } : {}),
      ...(target !== canonicalTarget ? { target } : {}),
    };
    edges.push({
      id: `system-relationship:${encodeURIComponent(relationship.id)}`,
      type: 'systemRelationship',
      className: scenarioPresentationClassName(scenarioElementState(
        scenarioPresentation,
        Boolean(scenarioPresentation?.activeRelationshipIds.has(relationship.id)),
      )),
      source,
      target,
      sourceHandle: CANVAS_OUTPUT_PORT_ID,
      targetHandle: CANVAS_INPUT_PORT_ID,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: relationship.kind === 'external-orchestration' ? '#6b7280' : '#6d28d9',
      },
      selectable: true,
      focusable: true,
      deletable: false,
      reconnectable: false,
      interactionWidth: 34,
      data: {
        relationship,
        projection: 'system-relationship',
        ...(Object.keys(endpointAliases).length > 0 ? { endpointAliases } : {}),
        proposalState,
        readOnly: proposalState === 'removed',
        scenarioState: scenarioElementState(
          scenarioPresentation,
          Boolean(scenarioPresentation?.activeRelationshipIds.has(relationship.id)),
        ),
      },
    });
  }

  return { nodes, edges };
}
