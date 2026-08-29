import { Edge, MarkerType } from '@xyflow/react';

import {
  applyGraphOperations,
  GraphEdge,
  GraphOperation,
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
  return [...edge.data.domainEdgeIds];
}

export function isSubgraphProxyEdge(edge: CanvasFlowEdge): boolean {
  return edge.data.projection === 'subgraph-proxy';
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
  return !isSubgraphProxyEdge(edge) && edge.data.domainEdgeIds.length === 1;
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

function subgraphFlowNode(subgraph: GraphSubgraph): CanvasFlowNode {
  const width = subgraph.collapsed ? CONTRACT_NODE_WIDTH : subgraph.dimensions.width;
  const height = subgraph.collapsed ? CONTRACT_NODE_HEIGHT : subgraph.dimensions.height;
  return {
    id: subgraph.id,
    type: 'subgraph',
    position: subgraph.position,
    width,
    height,
    initialWidth: width,
    initialHeight: height,
    style: { width, height },
    selectable: true,
    draggable: true,
    focusable: true,
    connectable: false,
    ariaLabel: `${subgraph.label} subgraph, ${subgraph.collapsed ? 'collapsed' : 'expanded'}`,
    data: { ...subgraph },
  };
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

  const baseNodeIds = new Set(graph.nodes.map((node) => node.id));
  const sourceNodes = [...graph.nodes];
  for (const node of preview.nodes) {
    if (!baseNodeIds.has(node.id)) sourceNodes.push(node);
  }
  const nodeUpdates = new Map(
    (visibleProposal?.operations ?? [])
      .filter(
        (operation): operation is Extract<GraphOperation, { type: 'update_node' }> =>
          operation.type === 'update_node',
      )
      .map((operation) => [operation.nodeId, operation.patch]),
  );

  const subgraphsById = new Map(preview.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const nodes: CanvasFlowNode[] = [
    ...preview.subgraphs.map(subgraphFlowNode),
    ...sourceNodes.map((node) => {
    const patched = nodeUpdates.has(node.id) ? { ...node, ...nodeUpdates.get(node.id) } : node;
    const parent = patched.parentId ? subgraphsById.get(patched.parentId) : undefined;
    const diff = visibleProposal?.diff;
    const proposalState = diff?.addedNodeIds.includes(node.id)
      ? 'added'
      : diff?.removedNodeIds.includes(node.id)
        ? 'removed'
        : diff?.updatedNodeIds.includes(node.id)
          ? 'updated'
          : undefined;
    return {
      id: patched.id,
      type: 'contractNode',
      position: patched.position,
      initialWidth: CONTRACT_NODE_WIDTH,
      initialHeight: CONTRACT_NODE_HEIGHT,
      ...(patched.parentId
        ? { parentId: patched.parentId, extent: 'parent' as const, expandParent: false }
        : {}),
      hidden: Boolean(parent?.collapsed),
      data: { ...patched, proposalState },
    };
    }),
  ];

  const baseEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const sourceEdges = [...graph.edges];
  for (const edge of preview.edges) {
    if (!baseEdgeIds.has(edge.id)) sourceEdges.push(edge);
  }
  const edgeUpdates = new Map(
    (visibleProposal?.operations ?? [])
      .filter(
        (operation): operation is Extract<GraphOperation, { type: 'update_edge' }> =>
          operation.type === 'update_edge',
      )
      .map((operation) => [operation.edgeId, operation.patch]),
  );

  const domainEdges: ProjectedDomainEdge[] = sourceEdges.map((edge) => {
    const patched = edgeUpdates.has(edge.id) ? { ...edge, ...edgeUpdates.get(edge.id) } : edge;
    const sourceParent = subgraphsById.get(
      preview.nodes.find((node) => node.id === patched.source)?.parentId ?? '',
    );
    const targetParent = subgraphsById.get(
      preview.nodes.find((node) => node.id === patched.target)?.parentId ?? '',
    );
    return {
      edge: patched,
      source: sourceParent?.collapsed ? sourceParent.id : patched.source,
      target: targetParent?.collapsed ? targetParent.id : patched.target,
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
