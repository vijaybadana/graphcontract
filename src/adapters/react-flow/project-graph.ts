import { Edge, MarkerType } from '@xyflow/react';

import {
  applyGraphOperations,
  GraphEdge,
  GraphNode,
  GraphProposal,
  GraphSubgraph,
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

const SUBGRAPH_BODY_INSET = 12;
const SUBGRAPH_HEADER_HEIGHT = 56;
const RUNTIME_INSTANCE_WIDTH = 188;
const RUNTIME_INSTANCE_HEIGHT = 58;
const RUNTIME_INSTANCE_VERTICAL_GAP = 20;

export type CanvasEdgeData = {
  edge: GraphEdge;
  domainEdgeIds: string[];
  projection: 'domain' | 'subgraph-proxy' | 'runtime-instance';
  runtimeInstanceId?: string;
  presentation: CanvasEdgePresentation;
  [key: string]: unknown;
};

export type CanvasFlowEdge = Edge<CanvasEdgeData>;

export type CanvasEdgePresentation = {
  /** The stored routing mode; loop remains a derived presentation only. */
  mode: GraphEdge['mode'];
  loop: boolean;
  invalid: boolean;
  frozen: boolean;
  proposalState?: 'added' | 'updated' | 'removed';
  /** Runtime-only lines visually attach observed instances without becoming routes. */
  runtimeInstance?: boolean;
};

export type CanvasProjectionMode = 'design' | 'runtime';
export type CanvasProjectionOptions = {
  mode?: CanvasProjectionMode;
  runtimeFixture?: RuntimeProjectionFixture | null;
};

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
  const domainEdgeIds = edge.data?.domainEdgeIds;
  return Array.isArray(domainEdgeIds)
    ? domainEdgeIds.filter((edgeId): edgeId is string => typeof edgeId === 'string')
    : [];
}

export function isSubgraphProxyEdge(edge: CanvasFlowEdge): boolean {
  return edge.data?.projection === 'subgraph-proxy';
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
  return edge.data?.projection === 'domain' && domainEdgeIdsForCanvasEdge(edge).length === 1;
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

function proposalStateForEdges(
  edges: readonly GraphEdge[],
  proposal: GraphProposal | null,
): CanvasEdgePresentation['proposalState'] {
  if (edges.some((edge) => edgeVisualState(edge.id, proposal).removed)) return 'removed';
  if (edges.some((edge) => edgeVisualState(edge.id, proposal).added)) return 'added';
  if (edges.some((edge) => edgeVisualState(edge.id, proposal).updated)) return 'updated';
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
): CanvasFlowEdge {
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
    className: `contract-edge contract-edge--${presentation.mode}`,
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
    data: { edge, domainEdgeIds, projection, presentation },
  };
}

type ProposalVisualState = 'added' | 'updated' | 'removed';

function subgraphFlowNode(
  subgraph: GraphSubgraph,
  graph: WorkflowGraph,
  proposalState?: ProposalVisualState,
): CanvasFlowNode {
  const width = subgraph.collapsed ? CONTRACT_NODE_WIDTH : subgraph.dimensions.width;
  const height = subgraph.collapsed ? CONTRACT_NODE_HEIGHT : subgraph.dimensions.height;
  const removed = proposalState === 'removed';
  return {
    id: subgraph.id,
    type: 'subgraph',
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
      data: { ...node, proposalState, invalid, frozen, outsideSubgraph },
    };
  }

  const template = sendTemplateData(node, preview.edges);
  return {
    id: node.id,
    type: 'contractNode',
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
  const membershipAffectedSubgraphs = visibleProposal
    ? membershipAffectedSubgraphIds(graph, visibleProposal.operations)
    : new Set<string>();
  const subgraphProposalState = (subgraphId: string): ProposalVisualState | undefined => {
    if (diff?.removedSubgraphIds?.includes(subgraphId)) return 'removed';
    if (diff?.addedSubgraphIds?.includes(subgraphId)) return 'added';
    if (diff?.updatedSubgraphIds?.includes(subgraphId) || membershipAffectedSubgraphs.has(subgraphId)) {
      return 'updated';
    }
    return undefined;
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

  const subgraphsById = new Map(preview.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const validationIssues = validateGraph(preview);
  const nodes: CanvasFlowNode[] = [
    ...sourceSubgraphs.map((subgraph) => subgraphFlowNode(subgraph, preview, subgraphProposalState(subgraph.id))),
    ...sourceNodes.map((node) =>
      projectDomainNode(
        node,
        preview,
        subgraphsById,
        diff,
        validationIssues,
        runtimeTemplateNodeIds,
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
  ): CanvasEdgePresentation => ({
    mode: edge.mode,
    loop: group.some((candidate) => loopEdgeIds.has(candidate.id)),
    invalid: group.some((candidate) => isEdgeInvalid(candidate, preview, validationIssues)),
    frozen: graph.status === 'frozen',
    proposalState: proposalStateForEdges(group, visibleProposal),
  });
  for (const domainEdge of domainEdges) {
    const collapsedInternal =
      domainEdge.source === domainEdge.target && domainEdge.source !== domainEdge.edge.source;
    if (collapsedInternal) continue;

    const isProxy =
      domainEdge.source !== domainEdge.edge.source || domainEdge.target !== domainEdge.edge.target;
    if (!isProxy) {
      edges.push(
        projectEdge(
          domainEdge,
          canvasEdgesReconnectable,
          [domainEdge.edge.id],
          'domain',
          edgePresentation(domainEdge.edge),
        ),
      );
      continue;
    }

    const key = `${domainEdge.source}\u0000${domainEdge.target}`;
    proxyEdges.set(key, [...(proxyEdges.get(key) ?? []), domainEdge]);
  }

  for (const groupedEdges of proxyEdges.values()) {
    const [first] = groupedEdges;
    edges.push(
      projectEdge(
        first,
        false,
        groupedEdges.map(({ edge }) => edge.id),
        'subgraph-proxy',
        edgePresentation(first.edge, groupedEdges.map(({ edge }) => edge)),
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
          },
        ),
      );
    }
  }

  return { nodes, edges };
}
