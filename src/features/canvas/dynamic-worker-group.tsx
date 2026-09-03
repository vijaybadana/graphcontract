'use client';

import { useCallback, type CSSProperties } from 'react';
import {
  Handle,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
  type Node,
  type NodeProps,
} from '@xyflow/react';

import type { GraphNode, SendTemplateAnatomy, SendTemplateAnatomyNode } from '@/src/domain';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
} from '@/src/application/layout-workflow';
import {
  constrainCanvasContainerDimensions,
  type CanvasContainerResizeLimits,
} from '@/src/application/subgraph-resize';

import { useCanvasNodeReviewFocus } from './canvas-review-focus';
import { ContractNodeCard } from './contract-node';
import './dynamic-worker-group.css';

export type DynamicWorkerGroupData = {
  [key: string]: unknown;
  label: string;
  sendEdgeId: string;
  templateNodeId: string;
  memberNodeIds: string[];
  memberEdgeIds: string[];
  mergeNodeId: string;
  payloadLabel: string;
  templateAnatomy?: SendTemplateAnatomy;
  onActivate?: (templateNodeId: string) => void;
  layoutEditable?: boolean;
  active?: boolean;
  resizeLimits?: CanvasContainerResizeLimits;
  onResize?: (sendEdgeId: string, dimensions: { width: number; height: number }) => void;
};

export type DynamicWorkerGroupFlowNode = Node<DynamicWorkerGroupData, 'dynamicWorkerGroup'>;

function declaredTemplateGraphNode(node: SendTemplateAnatomyNode): GraphNode {
  const base = {
    id: node.id,
    label: node.label,
    position: { x: 0, y: 0 },
  };
  if (node.kind === 'step') {
    return { ...base, kind: 'step', executor: node.executor ?? 'deterministic' };
  }
  return { ...base, kind: node.kind };
}

/**
 * A render-only compound boundary derived from Send/map semantics. It is not
 * a canonical GraphSubgraph and never creates worker instances or persistence.
 */
export function DynamicWorkerGroup({ data, id }: NodeProps<DynamicWorkerGroupFlowNode>) {
  const reviewFocusState = useCanvasNodeReviewFocus(data.templateNodeId);
  const anatomy = data.templateAnatomy;
  const resizeLimits = data.resizeLimits;
  const onResize = data.onResize;
  const sendEdgeId = data.sendEdgeId;
  const finishResize = useCallback(
    (_: unknown, dimensions: { width: number; height: number }) => {
      if (!resizeLimits) return;
      onResize?.(sendEdgeId, constrainCanvasContainerDimensions(dimensions, resizeLimits));
    },
    [onResize, resizeLimits, sendEdgeId],
  );
  const allowResize = useCallback(
    (_: unknown, dimensions: { width: number; height: number }) => {
      if (!resizeLimits) return false;
      const constrained = constrainCanvasContainerDimensions(dimensions, resizeLimits);
      return constrained.width === dimensions.width && constrained.height === dimensions.height;
    },
    [resizeLimits],
  );
  const anatomyNodeById = new Map(anatomy?.nodes.map((node) => [node.id, node]) ?? []);
  const markerId = `dynamic-worker-arrow-${data.sendEdgeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return (
    <div
      className={`dynamic-worker-group ${data.active ? 'is-active' : ''} ${reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''}`}
      data-send-edge-id={data.sendEdgeId}
      data-template-node-id={data.templateNodeId}
      data-member-count={data.memberNodeIds.length}
    >
      {data.layoutEditable && data.active && resizeLimits && (
        <NodeResizeControl
          nodeId={id}
          position="bottom-right"
          variant={ResizeControlVariant.Handle}
          minWidth={resizeLimits.minWidth}
          minHeight={resizeLimits.minHeight}
          maxWidth={resizeLimits.maxWidth}
          maxHeight={resizeLimits.maxHeight}
          shouldResize={allowResize}
          onResizeEnd={finishResize}
          className="dynamic-worker-group-resize-control nodrag nopan"
        />
      )}
      <Handle id={CANVAS_INPUT_PORT_ID} type="target" position={Position.Left} className="dynamic-worker-group-port dynamic-worker-group-port--input" />
      <Handle id={CANVAS_OUTPUT_PORT_ID} type="source" position={Position.Right} className="dynamic-worker-group-port dynamic-worker-group-port--output" />
      <span className="dynamic-worker-group-copy dynamic-worker-group-copy--back" aria-hidden="true" />
      <span className="dynamic-worker-group-copy dynamic-worker-group-copy--middle" aria-hidden="true" />
      {anatomy && (
        <div className="dynamic-worker-template-flow" aria-hidden="true">
          <svg
            className="dynamic-worker-template-edge-layer"
            viewBox={`0 0 ${anatomy.dimensions.width} ${anatomy.dimensions.height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" />
              </marker>
            </defs>
            {anatomy.edges.map((edge) => {
              const source = anatomyNodeById.get(edge.source);
              const target = anatomyNodeById.get(edge.target);
              if (!source || !target) return null;
              const sourceX = source.position.x + source.dimensions.width;
              const sourceY = source.position.y + source.dimensions.height / 2;
              const targetX = target.position.x;
              const targetY = target.position.y + target.dimensions.height / 2;
              const midpointX = sourceX + (targetX - sourceX) / 2;
              return (
                <path
                  key={edge.id}
                  className="dynamic-worker-template-edge"
                  d={`M ${sourceX} ${sourceY} C ${midpointX} ${sourceY}, ${midpointX} ${targetY}, ${targetX} ${targetY}`}
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </svg>
          {anatomy.nodes
            .filter((node) => node.id !== anatomy.canonicalTemplateNodeId)
            .map((node) => (
              <div
                key={node.id}
                className="dynamic-worker-template-node"
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  width: node.dimensions.width,
                  height: node.dimensions.height,
                } as CSSProperties}
              >
                <ContractNodeCard
                  data={declaredTemplateGraphNode(node)}
                  renderHandles={false}
                />
              </div>
            ))}
        </div>
      )}
      <button
        type="button"
        className="dynamic-worker-group-header dynamic-worker-group-drag-surface nopan"
        aria-label={`${data.label}, declared dynamic subgraph template ×N with ${data.memberNodeIds.length} steps and ${data.memberEdgeIds.length} connections. Focus canonical worker template.`}
        onClick={(event) => {
          event.stopPropagation();
          data.onActivate?.(data.templateNodeId);
        }}
      >
        <span>{data.label}</span>
        <strong>Dynamic subgraph template</strong>
      </button>
      <span className="dynamic-worker-group-payload" aria-hidden="true">
        Send ×N · {data.payloadLabel} · {data.memberNodeIds.length} steps
      </span>
    </div>
  );
}
