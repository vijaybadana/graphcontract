'use client';

import { OnNodeDrag, useNodesState } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ContractFlowNode } from '@/src/features/canvas/contract-node';
import { AlignmentGuides, CanvasPosition, snapNodeToAlignment } from './canvas-geometry';

type CanvasNodeInteractionsOptions = {
  projectedNodes: ContractFlowNode[];
  editable: boolean;
  onCommitPositions: (positions: Record<string, CanvasPosition>) => void;
};

type DragSnapshot = {
  positions: Record<string, CanvasPosition>;
};

export function useCanvasNodeInteractions({
  projectedNodes,
  editable,
  onCommitPositions,
}: CanvasNodeInteractionsOptions) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ContractFlowNode>(projectedNodes);
  const [guides, setGuides] = useState<AlignmentGuides>({});
  const [collisionNodeIds, setCollisionNodeIds] = useState<string[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const lastDragRef = useRef<DragSnapshot | null>(null);

  useEffect(() => {
    if (!draggingRef.current) setNodes(projectedNodes);
  }, [projectedNodes, setNodes]);

  const onNodeDragStart = useCallback<OnNodeDrag<ContractFlowNode>>((_, node, draggedNodes) => {
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
  }, []);

  const onNodeDrag = useCallback<OnNodeDrag<ContractFlowNode>>(
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

  const onNodeDragStop = useCallback<OnNodeDrag<ContractFlowNode>>(
    (_, node, draggedNodes) => {
      const positions =
        lastDragRef.current?.positions ??
        Object.fromEntries(
          (draggedNodes.length > 0 ? draggedNodes : [node]).map((draggedNode) => [
            draggedNode.id,
            draggedNode.position,
          ]),
        );
      draggingRef.current = false;
      lastDragRef.current = null;
      setGuides({});
      setCollisionNodeIds([]);
      setDraggedNodeId(null);
      if (editable) onCommitPositions(positions);
    },
    [editable, onCommitPositions],
  );

  const renderedNodes = useMemo(() => {
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
    guides,
    onNodesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  };
}
