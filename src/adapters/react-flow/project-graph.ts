import { Edge, MarkerType } from '@xyflow/react';

import {
  applyGraphOperations,
  GraphEdge,
  GraphNode,
  GraphProposal,
  GraphSubgraph,
  NonNativeRelationship,
  Provenance,
  ProvenanceRepresentation,
  resolveEffectiveCapabilities,
  RuntimeProjectionFixture,
  validateGraph,
  WorkflowGraph,
} from '@/src/domain';
import {
  CONTRACT_NODE_HEIGHT,
  CONTRACT_NODE_WIDTH,
} from '@/src/application/canvas-geometry';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
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
const RUNTIME_INSTANCE_WIDTH = 188;
const RUNTIME_INSTANCE_HEIGHT = 58;
const RUNTIME_INSTANCE_VERTICAL_GAP = 20;

export type CanvasEdgeData = {
  edge: GraphEdge;
  domainEdgeIds: string[];
  projection: 'domain' | 'subgraph-proxy' | 'runtime-instance';
  /** Review metadata stays keyed by canonical edges even when endpoints collapse. */
  review?: CanvasEdgeReviewProjection;
  runtimeInstanceId?: string;
  /** Evidence markers are an optional, workspace-only overlay. */
  evidenceMarker?: number;
  onEvidenceActivate?: (edgeId: string) => void;
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

type EdgeVisualState = {
  added: boolean;
  removed: boolean;
  updated: boolean;
};

const proxyEdgeId = (source: string, target: string) =>
  `subgraph-proxy:${encodeURIComponent(source)}:${encodeURIComponent(target)}`;

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

function edgeVisualState(
  edgeId: string,
  proposal: GraphProposal | null,
): EdgeVisualState {
  const diff = proposal?.diff;
  return {
    added: Boolean(diff?.addedEdgeIds.includes(edgeId)),
    removed: Boolean(diff?.removedEdgeIds.includes(edgeId)),
    updated: Boolean(diff?.updatedEdgeIds.includes(edgeId)),
  };
}

function proposalStateForEdge(
  edgeId: string,
  proposal: GraphProposal | null,
): ProposalVisualState | undefined {
  const state = edgeVisualState(edgeId, proposal);
  if (state.removed) return 'removed';
  if (state.added) return 'added';
  if (state.updated) return 'updated';
  return undefined;
}

function aggregateReviewStates(
  states: readonly CanvasReviewState[],
): CanvasReviewAggregate {
  if (states.length === 0) return 'unchanged';
  return new Set(states).size === 1 ? states[0] : 'mixed';
}

function reviewProjectionForEdges(
  edges: readonly GraphEdge[],
  proposal: GraphProposal | null,
): CanvasEdgeReviewProjection {
  const entries = edges
    .map((edge) => [edge.id, proposalStateForEdge(edge.id, proposal) ?? 'unchanged'] as const)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
  return {
    aggregate: aggregateReviewStates(entries.map(([, state]) => state)),
    byDomainEdgeId: Object.fromEntries(entries),
  };
}

function proposalStateForRelationship(
  relationshipId: string,
  proposal: GraphProposal | null,
): ProposalVisualState | undefined {
  const diff = proposal?.diff;
  if (diff?.removedRelationshipIds.includes(relationshipId)) return 'removed';
  if (diff?.addedRelationshipIds.includes(relationshipId)) return 'added';
  if (diff?.updatedRelationshipIds.includes(relationshipId)) return 'updated';
  return undefined;
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
): CanvasNativeEdge {
  const color = presentation.frozen
    ? '#9ca3af'
    : presentation.invalid
      ? '#e0353d'
      : presentation.loop
        ? '#ea6a18'
        : presentation.mode === 'conditional'
          ? '#7136cc'
          : presentation.mode === 'send'
            ? '#5969c8'
          : presentation.mode === 'fallback'
            ? '#8b55d8'
          : presentation.mode === 'command'
            ? '#3346c8'
            : presentation.proposalState === 'added'
              ? '#159160'
              : presentation.proposalState === 'removed'
                ? '#db4b55'
                : presentation.proposalState === 'updated'
                  ? '#c47b24'
                  : '#303a35';
  return {
    id:
      projection === 'subgraph-proxy'
        ? proxyEdgeId(source, target)
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
    label: presentation.runtimeInstance
      ? undefined
      : edge.label ||
        (presentation.mode === 'send' ? 'Send ×N' : presentation.mode === 'fallback' ? 'fallback' : undefined),
    markerEnd: { type: MarkerType.ArrowClosed, color },
    animated: presentation.proposalState === 'added',
    reconnectable: projection === 'domain' && reconnectable && !presentation.frozen,
    interactionWidth: 28,
    pathOptions: { borderRadius: 16, offset: 28 },
    style: {
      stroke: color,
      strokeWidth: presentation.proposalState ? 2.5 : 1.8,
      strokeDasharray:
        presentation.runtimeInstance || presentation.mode === 'send'
          ? '7 5'
          : presentation.proposalState === 'removed'
            ? '6 5'
            : undefined,
      opacity: presentation.proposalState === 'removed' ? 0.65 : 1,
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
  const width = subgraph.collapsed ? CONTRACT_NODE_WIDTH : subgraph.dimensions.width;
  const height = subgraph.collapsed ? CONTRACT_NODE_HEIGHT : subgraph.dimensions.height;
  const removed = proposalState === 'removed';
  return {
    id: subgraph.id,
    type: 'subgraph',
    className: scenarioPresentationClassName(scenarioState),
    position: subgraph.position,
    // Expanded containers sit directly below their member nodes. Restricting
    // their drag handle to the rendered header/border keeps children fully
    // interactive while preserving a reliable parent selection surface.
    zIndex: removed ? -1 : subgraph.collapsed ? 10 : 0,
    width,
    height,
    initialWidth: width,
    initialHeight: height,
    style: { width, height },
    selectable: !removed,
    draggable: !removed,
    dragHandle: '.subgraph-node-drag-surface, .subgraph-node-boundary-drag-surface',
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
  const centre = {
    x: node.position.x + CONTRACT_NODE_WIDTH / 2,
    y: node.position.y + CONTRACT_NODE_HEIGHT / 2,
  };
  return subgraphs.some(
    (subgraph) =>
      !subgraph.collapsed &&
      centre.x > subgraph.position.x + SUBGRAPH_BODY_INSET &&
      centre.x < subgraph.position.x + subgraph.dimensions.width - SUBGRAPH_BODY_INSET &&
      centre.y > subgraph.position.y + SUBGRAPH_HEADER_HEIGHT &&
      centre.y < subgraph.position.y + subgraph.dimensions.height - SUBGRAPH_BODY_INSET,
  );
}

function membershipAffectedSubgraphIds(
  graph: WorkflowGraph,
  operations: GraphProposal['operations'],
): Set<string> {
  const affected = new Set<string>();
  let candidate = structuredClone(graph);

  for (const operation of operations) {
    if (operation.type === 'assign_nodes_to_subgraph') {
      if (candidate.subgraphs.some((subgraph) => subgraph.id === operation.subgraphId)) {
        affected.add(operation.subgraphId);
      }
      for (const nodeId of new Set(operation.nodeIds)) {
        const node = candidate.nodes.find((candidateNode) => candidateNode.id === nodeId);
        if (node?.parentId) affected.add(node.parentId);
      }
    }
    if (operation.type === 'remove_nodes_from_subgraph') {
      for (const nodeId of new Set(operation.nodeIds)) {
        const node = candidate.nodes.find((candidateNode) => candidateNode.id === nodeId);
        if (node?.parentId) affected.add(node.parentId);
      }
    }
    candidate = applyGraphOperations(candidate, [operation]).graph;
  }

  return affected;
}

function absolutePosition(
  node: GraphNode,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
) {
  const parent = node.parentId ? subgraphsById.get(node.parentId) : undefined;
  return parent
    ? { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
    : node.position;
}

function nodeProposalState(
  nodeId: string,
  diff: GraphProposal['diff'] | undefined,
): ProposalVisualState | undefined {
  const membershipChangedNodeIds = diff?.membershipChangedNodeIds ?? [];
  if (diff?.addedNodeIds.includes(nodeId)) return 'added';
  if (diff?.removedNodeIds.includes(nodeId)) return 'removed';
  if (diff?.updatedNodeIds.includes(nodeId) || membershipChangedNodeIds.includes(nodeId)) {
    return 'updated';
  }
  return undefined;
}

function descendantReviewStateForSubgraph(
  graph: WorkflowGraph,
  preview: WorkflowGraph,
  subgraphId: string,
  proposal: GraphProposal | null,
): CanvasReviewAggregate {
  if (!proposal) return 'unchanged';

  const descendantNodeIds = new Set(
    [...graph.nodes, ...preview.nodes]
      .filter((node) => node.parentId === subgraphId)
      .map((node) => node.id),
  );
  const states: ProposalVisualState[] = [];
  for (const nodeId of [...descendantNodeIds].sort()) {
    const state = nodeProposalState(nodeId, proposal.diff);
    if (state) states.push(state);
  }

  const changedEdgeIds = new Set([
    ...proposal.diff.addedEdgeIds,
    ...proposal.diff.updatedEdgeIds,
    ...proposal.diff.removedEdgeIds,
  ]);
  for (const edgeId of [...changedEdgeIds].sort()) {
    const touchesDescendant = [...graph.edges, ...preview.edges].some(
      (edge) =>
        edge.id === edgeId &&
        (descendantNodeIds.has(edge.source) || descendantNodeIds.has(edge.target)),
    );
    const state = proposalStateForEdge(edgeId, proposal);
    if (touchesDescendant && state) states.push(state);
  }

  const changedRelationshipIds = new Set([
    ...proposal.diff.addedRelationshipIds,
    ...proposal.diff.updatedRelationshipIds,
    ...proposal.diff.removedRelationshipIds,
  ]);
  for (const relationshipId of [...changedRelationshipIds].sort()) {
    const touchesDescendant = [
      ...(graph.relationships ?? []),
      ...(preview.relationships ?? []),
    ].some(
      (relationship) =>
        relationship.id === relationshipId &&
        [relationship.source, relationship.target].some(
          (endpoint) => endpoint.kind === 'node' && descendantNodeIds.has(endpoint.nodeId),
        ),
    );
    const state = proposalStateForRelationship(relationshipId, proposal);
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

function projectDomainNode(
  node: GraphNode,
  preview: WorkflowGraph,
  subgraphsById: ReadonlyMap<string, GraphSubgraph>,
  diff: GraphProposal['diff'] | undefined,
  validationIssues: ReturnType<typeof validateGraph>,
  runtimeHiddenNodeIds: ReadonlySet<string>,
  scenarioState?: ScenarioElementState,
): CanvasFlowNode {
  const parent = node.parentId ? subgraphsById.get(node.parentId) : undefined;
  const proposalState = nodeProposalState(node.id, diff);
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
  const hidden = Boolean(parent?.collapsed) || runtimeHiddenNodeIds.has(node.id);

  if (node.kind === 'merge') {
    return {
      id: node.id,
      type: 'mergeJunction',
      className: scenarioPresentationClassName(scenarioState),
      position: node.position,
      initialWidth: CONTRACT_NODE_WIDTH,
      initialHeight: CONTRACT_NODE_HEIGHT,
      hidden,
      selectable: proposalState !== 'removed',
      draggable: proposalState !== 'removed',
      focusable: proposalState !== 'removed',
      ariaLabel: `${node.label} Merge junction, reducer ${node.merge.reducer.name || 'unset'}, ${
        node.merge.waitingForDynamicInputs ? 'waiting for dynamic inputs' : 'invalid waiting policy'
      }${invalid ? ', invalid' : ''}${frozen ? ', frozen' : ''}`,
      ...parentProperties,
      data: { ...node, proposalState, invalid, frozen, outsideSubgraph, scenarioState },
    };
  }

  const template = sendTemplateData(node, preview.edges);
  return {
    id: node.id,
    type: 'contractNode',
    className: scenarioPresentationClassName(scenarioState),
    position: node.position,
    initialWidth: CONTRACT_NODE_WIDTH,
    initialHeight: CONTRACT_NODE_HEIGHT,
    hidden,
    selectable: proposalState !== 'removed',
    draggable: proposalState !== 'removed',
    focusable: proposalState !== 'removed',
    ariaLabel: `${node.label} ${node.kind}${template ? ', dynamic worker template ×N' : ''}${
      invalid ? ', invalid' : ''
    }${frozen ? ', frozen' : ''}`,
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
  proposal: GraphProposal | null,
  options: CanvasProjectionOptions = {},
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const visibleProposal =
    proposal?.status === 'pending' || proposal?.status === 'invalid' ? proposal : null;
  const preview = visibleProposal
    ? applyGraphOperations(graph, visibleProposal.operations).graph
    : graph;
  const runtime =
    options.mode === 'runtime' && !visibleProposal
      ? runtimeProjectionAvailability(graph, options.runtimeFixture)
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
  const diff = visibleProposal?.diff;
  const scenarioPresentation = options.scenarioPresentation ?? null;
  const membershipAffectedSubgraphs = visibleProposal
    ? membershipAffectedSubgraphIds(graph, visibleProposal.operations)
    : new Set<string>();
  const subgraphReviewProjection = (subgraph: GraphSubgraph) => {
    let proposalState: ProposalVisualState | undefined;
    if (diff?.removedSubgraphIds?.includes(subgraph.id)) proposalState = 'removed';
    else if (diff?.addedSubgraphIds?.includes(subgraph.id)) proposalState = 'added';
    else if (
      diff?.updatedSubgraphIds?.includes(subgraph.id) ||
      membershipAffectedSubgraphs.has(subgraph.id)
    ) {
      proposalState = 'updated';
    }
    const descendantReviewState = subgraph.collapsed
      ? descendantReviewStateForSubgraph(graph, preview, subgraph.id, visibleProposal)
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
    ...graph.subgraphs.filter((subgraph) => !previewSubgraphIds.has(subgraph.id)),
  ];

  // The candidate graph is the authoritative preview. Keep deleted accepted
  // elements as ghosts so the existing review UI can show removals, but never
  // reconstruct active candidate nodes from individual operation patches.
  const previewNodeIds = new Set(preview.nodes.map((node) => node.id));
  const sourceNodes = [
    ...preview.nodes,
    ...graph.nodes.filter((node) => !previewNodeIds.has(node.id)),
  ];
  const nodeScenarioState = (nodeId: string) =>
    scenarioElementState(
      scenarioPresentation,
      Boolean(scenarioPresentation?.activeNodeIds.has(nodeId)),
    );
  const subgraphScenarioState = (subgraphId: string) =>
    scenarioElementState(
      scenarioPresentation,
      sourceNodes.some(
        (node) => node.parentId === subgraphId && scenarioPresentation?.activeNodeIds.has(node.id),
      ),
    );

  const subgraphsById = new Map(preview.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const validationIssues = validateGraph(preview);
  const nodes: CanvasFlowNode[] = [
    ...sourceSubgraphs.map((subgraph) => {
      const review = subgraphReviewProjection(subgraph);
      return subgraphFlowNode(
        subgraph,
        preview,
        review.proposalState,
        subgraphScenarioState(subgraph.id),
        review.descendantReviewState,
      );
    }),
    ...sourceNodes.map((node) =>
      projectDomainNode(
        node,
        preview,
        subgraphsById,
        diff,
        validationIssues,
        runtimeTemplateNodeIds,
        nodeScenarioState(node.id),
      ),
    ),
  ];

  const previewEdgeIds = new Set(preview.edges.map((edge) => edge.id));
  const sourceEdges = [
    ...preview.edges,
    ...graph.edges.filter((edge) => !previewEdgeIds.has(edge.id)),
  ].filter((edge) => !runtimeReplacedEdgeIds.has(edge.id));
  const loopEdgeIds = topologyDerivedLoopEdgeIds({ ...preview, edges: sourceEdges });
  const domainEdges: ProjectedDomainEdge[] = sourceEdges.map((edge) => {
    const sourceParent = subgraphsById.get(
      preview.nodes.find((node) => node.id === edge.source)?.parentId ?? '',
    );
    const targetParent = subgraphsById.get(
      preview.nodes.find((node) => node.id === edge.target)?.parentId ?? '',
    );
    return {
      edge,
      source: sourceParent?.collapsed ? sourceParent.id : edge.source,
      target: targetParent?.collapsed ? targetParent.id : edge.target,
    };
  });

  const proxyEdges = new Map<string, ProjectedDomainEdge[]>();
  const edges: CanvasFlowEdge[] = [];
  const canvasEdgesReconnectable = graph.status === 'draft' && !visibleProposal;
  const edgePresentation = (
    edge: GraphEdge,
    group: readonly GraphEdge[] = [edge],
    review: CanvasEdgeReviewProjection = reviewProjectionForEdges(group, visibleProposal),
  ): CanvasEdgePresentation => ({
    mode: edge.mode,
    loop: group.some((candidate) => loopEdgeIds.has(candidate.id)),
    invalid: group.some((candidate) => isEdgeInvalid(candidate, preview, validationIssues)),
    frozen: graph.status === 'frozen',
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

    const isProxy =
      domainEdge.source !== domainEdge.edge.source || domainEdge.target !== domainEdge.edge.target;
    if (!isProxy) {
      const group = [domainEdge.edge];
      const review = reviewProjectionForEdges(group, visibleProposal);
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

    const key = `${domainEdge.source}\u0000${domainEdge.target}`;
    proxyEdges.set(key, [...(proxyEdges.get(key) ?? []), domainEdge]);
  }

  for (const groupedEdges of proxyEdges.values()) {
    const [first] = groupedEdges;
    const group = groupedEdges.map(({ edge }) => edge);
    const review = reviewProjectionForEdges(group, visibleProposal);
    edges.push(
      projectEdge(
        first,
        false,
        group.map((edge) => edge.id),
        'subgraph-proxy',
        edgePresentation(first.edge, group, review),
        review,
      ),
    );
  }

  // Runtime evidence can only add ephemeral canvas elements. It never changes
  // the accepted graph, proposal diff, selection store, or persisted layout.
  if (runtime?.available) {
    const visibleEndpoint = (nodeId: string) => {
      const node = preview.nodes.find((candidate) => candidate.id === nodeId);
      const parent = node?.parentId ? subgraphsById.get(node.parentId) : undefined;
      return parent?.collapsed ? parent.id : nodeId;
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
  const externalTileWidth = 192;
  const externalTileHeight = 72;
  const externalTileGap = 168;
  const relationshipEndpointId = (endpoint: NonNativeRelationship['source']) =>
    endpoint.kind === 'node'
      ? endpoint.nodeId
      : `external-system:${encodeURIComponent(endpoint.externalId)}`;
  const visibleRelationshipEndpointId = (endpoint: NonNativeRelationship['source']) => {
    if (endpoint.kind === 'external') return relationshipEndpointId(endpoint);
    const node = sourceNodes.find((candidate) => candidate.id === endpoint.nodeId);
    const parent = node?.parentId ? subgraphsById.get(node.parentId) : undefined;
    return parent?.collapsed ? parent.id : endpoint.nodeId;
  };
  // Candidate relationships are authoritative during review. Base-only
  // records are retained strictly as removed ghosts; selection can still
  // inspect those accepted records, but no relationship ever becomes native.
  const previewRelationships = preview.relationships ?? [];
  const acceptedRelationships = graph.relationships ?? [];
  const previewRelationshipIds = new Set(previewRelationships.map((relationship) => relationship.id));
  const systemRelationships = [
    ...previewRelationships,
    ...acceptedRelationships.filter((relationship) => !previewRelationshipIds.has(relationship.id)),
  ].sort((left, right) => left.id.localeCompare(right.id));
  for (const relationship of systemRelationships) {
    const proposalState = proposalStateForRelationship(relationship.id, visibleProposal);
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
      const anchorParent = anchor?.parentId ? subgraphsById.get(anchor.parentId) : undefined;
      const anchorPosition = anchorParent?.collapsed
        ? anchorParent.position
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
            : anchorPosition.x + CONTRACT_NODE_WIDTH + externalTileGap,
          y: Math.max(12, anchorPosition.y + (CONTRACT_NODE_HEIGHT - externalTileHeight) / 2),
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
