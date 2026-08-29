import { Edge, MarkerType } from '@xyflow/react';

import {
  applyGraphOperations,
  GraphEdge,
  GraphProposal,
  GraphSubgraph,
  WorkflowGraph,
} from '@/src/domain';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';

const CONTRACT_NODE_WIDTH = 184;
const CONTRACT_NODE_HEIGHT = 114;

export type CanvasEdgeData = {
  edge: GraphEdge;
  domainEdgeIds: string[];
  projection: 'domain' | 'subgraph-proxy';
  [key: string]: unknown;
};

export type CanvasFlowEdge = Edge<CanvasEdgeData>;

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
  return node?.type === 'contractNode' && !node.hidden;
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
  return !isSubgraphProxyEdge(edge) && domainEdgeIdsForCanvasEdge(edge).length === 1;
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

function projectEdge(
  { edge, source, target }: ProjectedDomainEdge,
  state: EdgeVisualState,
  reconnectable: boolean,
  domainEdgeIds: string[],
  projection: CanvasEdgeData['projection'],
): CanvasFlowEdge {
  const color = state.added ? '#159160' : state.removed ? '#db4b55' : state.updated ? '#c47b24' : '#4f5954';
  return {
    id: projection === 'subgraph-proxy' ? proxyEdgeId(source, target) : edge.id,
    type: 'smoothstep',
    className: `contract-edge contract-edge--${edge.mode}`,
    source,
    target,
    label: edge.label || (edge.mode === 'fallback' ? 'fallback' : undefined),
    markerEnd: { type: MarkerType.ArrowClosed, color },
    animated: state.added,
    reconnectable: projection === 'domain' && reconnectable,
    interactionWidth: 28,
    pathOptions: { borderRadius: 16, offset: 28 },
    style: {
      stroke: color,
      strokeWidth: state.added || state.removed || state.updated ? 2.5 : 1.7,
      strokeDasharray: state.removed ? '6 5' : undefined,
      opacity: state.removed ? 0.65 : 1,
    },
    labelStyle: { fill: '#303a35', fontSize: 11, fontWeight: 720 },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
    labelBgPadding: [5, 3] as [number, number],
    labelBgBorderRadius: 6,
    data: { edge, domainEdgeIds, projection },
  };
}

type ProposalVisualState = 'added' | 'updated' | 'removed';

function subgraphFlowNode(
  subgraph: GraphSubgraph,
  proposalState?: ProposalVisualState,
): CanvasFlowNode {
  const width = subgraph.collapsed ? CONTRACT_NODE_WIDTH : subgraph.dimensions.width;
  const height = subgraph.collapsed ? CONTRACT_NODE_HEIGHT : subgraph.dimensions.height;
  const removed = proposalState === 'removed';
  return {
    id: subgraph.id,
    type: 'subgraph',
    position: subgraph.position,
    // Expanded containers are quiet canvas boundaries behind their members.
    // A collapsed container is an interactive card and must stay above any
    // unrelated node occupying the same coordinates so its expand control
    // cannot redirect the click to the obscuring node.
    zIndex: removed ? -1 : subgraph.collapsed ? 10 : -1,
    width,
    height,
    initialWidth: width,
    initialHeight: height,
    style: { width, height },
    selectable: !removed,
    draggable: !removed,
    focusable: !removed,
    connectable: false,
    ariaLabel: `${subgraph.label} subgraph, ${proposalState ? `proposed ${proposalState}, ` : ''}${subgraph.collapsed ? 'collapsed' : 'expanded'}`,
    data: { ...subgraph, proposalState },
  };
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

export function projectGraphToCanvas(
  graph: WorkflowGraph,
  proposal: GraphProposal | null,
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const visibleProposal =
    proposal?.status === 'pending' || proposal?.status === 'invalid' ? proposal : null;
  const preview = visibleProposal
    ? applyGraphOperations(graph, visibleProposal.operations).graph
    : graph;
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
  const nodes: CanvasFlowNode[] = [
    ...sourceSubgraphs.map((subgraph) => subgraphFlowNode(subgraph, subgraphProposalState(subgraph.id))),
    ...sourceNodes.map((node) => {
    const parent = node.parentId ? subgraphsById.get(node.parentId) : undefined;
    const membershipChangedNodeIds = diff?.membershipChangedNodeIds ?? [];
    const proposalState = diff?.addedNodeIds.includes(node.id)
      ? 'added'
      : diff?.removedNodeIds.includes(node.id)
        ? 'removed'
        : diff?.updatedNodeIds.includes(node.id) || membershipChangedNodeIds.includes(node.id)
          ? 'updated'
          : undefined;
    return {
      id: node.id,
      type: 'contractNode',
      position: node.position,
      initialWidth: CONTRACT_NODE_WIDTH,
      initialHeight: CONTRACT_NODE_HEIGHT,
      ...(node.parentId
        ? { parentId: node.parentId, extent: 'parent' as const, expandParent: false }
        : {}),
      hidden: Boolean(parent?.collapsed),
      data: { ...node, proposalState },
    };
    }),
  ];

  const previewEdgeIds = new Set(preview.edges.map((edge) => edge.id));
  const sourceEdges = [
    ...preview.edges,
    ...graph.edges.filter((edge) => !previewEdgeIds.has(edge.id)),
  ];

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
          edgeVisualState(domainEdge.edge.id, visibleProposal),
          canvasEdgesReconnectable,
          [domainEdge.edge.id],
          'domain',
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
        edgeVisualState(first.edge.id, visibleProposal),
        false,
        groupedEdges.map(({ edge }) => edge.id),
        'subgraph-proxy',
      ),
    );
  }

  return { nodes, edges };
}
