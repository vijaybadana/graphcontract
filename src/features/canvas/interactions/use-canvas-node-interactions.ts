'use client';

import { OnNodeDrag, useEdgesState, useNodesState } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CanvasFlowEdge,
  isCanvasEdgeSelected,
} from '@/src/adapters/react-flow/project-graph';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import { AlignmentGuides, CanvasPosition, snapNodeToAlignment } from './canvas-geometry';

type CanvasNodeInteractionsOptions = {
  projectedNodes: CanvasFlowNode[];
  projectedEdges: CanvasFlowEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  editable: boolean;
  onCommitPositions: (positions: Record<string, CanvasPosition>) => void;
};

type DragSnapshot = {
  positions: Record<string, CanvasPosition>;
};

const transientNodeFields = new Set(['selected', 'measured', 'dragging']);
const nodeProjectionKey = (node: CanvasFlowNode) =>
  JSON.stringify(node, (key, value) => (transientNodeFields.has(key) ? undefined : value));
const edgeProjectionKey = (edge: CanvasFlowEdge) =>
  JSON.stringify(edge, (key, value) => (key === 'selected' ? undefined : value));

/** A dragged container carries its children visually, but their relative graph
 * coordinates must never be committed as a side effect of that parent drag. */
export function positionsForCanvasCommit(
  draggedNodes: CanvasFlowNode[],
  positions: Record<string, CanvasPosition>,
): Record<string, CanvasPosition> {
  const draggedSubgraphIds = new Set(
    draggedNodes
      .filter((node) => node.type === 'subgraph')
      .map((node) => node.id),
  );
  if (draggedSubgraphIds.size === 0) return positions;

  const childIds = new Set(
    draggedNodes
      .filter(
        (node) =>
          node.type === 'contractNode' &&
          node.parentId &&
          draggedSubgraphIds.has(node.parentId),
      )
      .map((node) => node.id),
  );
  return Object.fromEntries(
    Object.entries(positions).filter(([nodeId]) => !childIds.has(nodeId)),
  );
}

function reconcileProjectedNodes(
  currentNodes: CanvasFlowNode[],
  projectedNodes: CanvasFlowNode[],
  selectedNodeIds: string[],
) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  let changed = currentNodes.length !== projectedNodes.length;
  const reconciled = projectedNodes.map((projectedNode, index) => {
    const currentNode = currentById.get(projectedNode.id);
    if (!currentNode) {
      changed = true;
      return { ...projectedNode, selected: selectedNodeIds.includes(projectedNode.id) };
    }
    if (currentNodes[index]?.id !== projectedNode.id) changed = true;
    if (nodeProjectionKey(currentNode) === nodeProjectionKey(projectedNode)) return currentNode;
    changed = true;
    return {
      ...projectedNode,
      selected: currentNode.selected,
      measured: currentNode.measured,
    };
  });
  return changed ? reconciled : currentNodes;
}

// Canonical graph projections flow into this layer, while React Flow owns
// transient selection and measurement. Feeding mirrored selection back through
// controlled props creates a StoreUpdater loop during rectangle selection.
function reconcileProjectedEdges(
  currentEdges: CanvasFlowEdge[],
  projectedEdges: CanvasFlowEdge[],
  selectedEdgeIds: string[],
) {
  const currentById = new Map(currentEdges.map((edge) => [edge.id, edge]));
  let changed = currentEdges.length !== projectedEdges.length;
  const reconciled = projectedEdges.map((projectedEdge, index) => {
    const currentEdge = currentById.get(projectedEdge.id);
    const selected = isCanvasEdgeSelected(projectedEdge, selectedEdgeIds);
    if (!currentEdge) {
      changed = true;
      return { ...projectedEdge, selected };
    }
    if (currentEdges[index]?.id !== projectedEdge.id) changed = true;
    if (
      edgeProjectionKey(currentEdge) === edgeProjectionKey(projectedEdge) &&
      currentEdge.selected === selected
    ) {
      return currentEdge;
    }
    changed = true;
    return { ...projectedEdge, selected };
  });
  return changed ? reconciled : currentEdges;
}

export function useCanvasInteractions({
  projectedNodes,
  projectedEdges,
  selectedNodeIds,
  selectedEdgeIds,
  editable,
  onCommitPositions,
}: CanvasNodeInteractionsOptions) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(projectedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>(projectedEdges);
  const [guides, setGuides] = useState<AlignmentGuides>({});
  const [collisionNodeIds, setCollisionNodeIds] = useState<string[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const lastDragRef = useRef<DragSnapshot | null>(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
    selectedEdgeIdsRef.current = selectedEdgeIds;
  }, [selectedEdgeIds, selectedNodeIds]);

  useEffect(() => {
    if (!draggingRef.current) {
      setNodes((currentNodes) =>
        reconcileProjectedNodes(currentNodes, projectedNodes, selectedNodeIdsRef.current),
      );
    }
  }, [projectedNodes, setNodes]);

  useEffect(() => {
    setEdges((currentEdges) =>
      reconcileProjectedEdges(currentEdges, projectedEdges, selectedEdgeIdsRef.current),
    );
  }, [projectedEdges, setEdges]);

  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        const selected = isCanvasEdgeSelected(edge, selectedEdgeIds);
        return edge.selected === selected ? edge : { ...edge, selected };
      }),
    );
  }, [selectedEdgeIds, setEdges]);

  const clearRenderedSelection = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.some((node) => node.selected)
        ? currentNodes.map((node) => (node.selected ? { ...node, selected: false } : node))
        : currentNodes,
    );
    setEdges((currentEdges) =>
      currentEdges.some((edge) => edge.selected)
        ? currentEdges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge))
        : currentEdges,
    );
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!editable) clearRenderedSelection();
  }, [clearRenderedSelection, editable]);

  const onNodeDragStart = useCallback<OnNodeDrag<CanvasFlowNode>>((_, node, draggedNodes) => {
    if (!editable) return;
    draggingRef.current = true;
    lastDragRef.current = {
      positions: Object.fromEntries(
        (draggedNodes.length > 0 ? draggedNodes : [node]).map((draggedNode) => [
          draggedNode.id,
          draggedNode.position,
        ]),
      ),
    };
    setDraggedNodeId(node.id);
  }, [editable]);

  const onNodeDrag = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_, node, draggedNodes) => {
      if (!editable) return;
      const group = draggedNodes.length > 0 ? draggedNodes : [node];
      const groupIds = new Set(group.map((draggedNode) => draggedNode.id));
      const result = snapNodeToAlignment(node, nodes, 8, groupIds);
      const delta = {
        x: result.position.x - node.position.x,
        y: result.position.y - node.position.y,
      };
      const positions = Object.fromEntries(
        group.map((draggedNode) => [
          draggedNode.id,
          {
            x: draggedNode.position.x + delta.x,
            y: draggedNode.position.y + delta.y,
          },
        ]),
      );
      lastDragRef.current = { positions };
      setGuides(result.guides);
      setCollisionNodeIds(result.collidingNodeIds);
      setNodes((current) =>
        current.map((currentNode) =>
          positions[currentNode.id]
            ? { ...currentNode, position: positions[currentNode.id] }
            : currentNode,
        ),
      );
    },
    [editable, nodes, setNodes],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_, node, draggedNodes) => {
      const dragged = draggedNodes.length > 0 ? draggedNodes : [node];
      const positions =
        lastDragRef.current?.positions ??
        Object.fromEntries(
          dragged.map((draggedNode) => [
            draggedNode.id,
            draggedNode.position,
          ]),
        );
      draggingRef.current = false;
      lastDragRef.current = null;
      setGuides({});
      setCollisionNodeIds([]);
      setDraggedNodeId(null);
      if (editable) onCommitPositions(positionsForCanvasCommit(dragged, positions));
    },
    [editable, onCommitPositions],
  );

  const renderedNodes = useMemo(() => {
    if (collisionNodeIds.length === 0 && draggedNodeId === null) return nodes;

    const collisions = new Set(collisionNodeIds);
    return nodes.map((node) => ({
      ...node,
      className: [
        node.className,
        collisions.has(node.id) ? 'canvas-node--collision-target' : '',
        node.id === draggedNodeId && collisions.size > 0 ? 'canvas-node--collision-source' : '',
      ]
        .filter(Boolean)
        .join(' '),
    }));
  }, [collisionNodeIds, draggedNodeId, nodes]);

  return {
    nodes: renderedNodes,
    edges,
    guides,
    onNodesChange,
    onEdgesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    clearRenderedSelection,
  };
}
