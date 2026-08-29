'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { GraphSubgraph } from '@/src/domain';
import './subgraph-node.css';

export type SubgraphNodeData = GraphSubgraph & {
  /** Review-only state projected from a pending graph proposal. */
  proposalState?: 'added' | 'updated' | 'removed';
  /**
   * The canvas projection accepts this callback without owning the workspace
   * mutation. The workspace seam supplies it when subgraph editing is wired.
   */
  onToggleCollapse?: (subgraphId: string, collapsed: boolean) => void;
  /** Projection-only edit affordance; it never belongs to the canonical graph. */
  collapseEditable?: boolean;
  [key: string]: unknown;
};

export type SubgraphFlowNode = Node<SubgraphNodeData, 'subgraph'>;

export function SubgraphNode({ data, selected }: NodeProps<SubgraphFlowNode>) {
  const action = data.collapsed ? 'Expand' : 'Collapse';
  const proposalClass = data.proposalState ? `is-proposed-${data.proposalState}` : '';
  const removed = data.proposalState === 'removed';
  const toggleCollapse = () => data.onToggleCollapse?.(data.id, !data.collapsed);
  const stopCanvasPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const handleToggleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    // React Flow also listens for keyboard interaction on its node wrapper.
    // Own these activation keys at the native button so one press cannot both
    // toggle the canonical state and select/pan the canvas.
    event.preventDefault();
    event.stopPropagation();
    toggleCollapse();
  };

  return (
    <div
      className={`subgraph-node-shell ${data.collapsed ? 'is-collapsed' : 'is-expanded'} ${selected ? 'is-selected' : ''} ${proposalClass}`}
      data-collapsed={data.collapsed}
      data-proposal-state={data.proposalState}
    >
      {!removed && (
        <Handle
          type="target"
          position={Position.Left}
          className="subgraph-node-handle"
        />
      )}
      {!data.collapsed && (
        <>
          <div className="subgraph-node-boundary-drag-surface subgraph-node-boundary-drag-surface--top" aria-hidden="true" />
          <div className="subgraph-node-boundary-drag-surface subgraph-node-boundary-drag-surface--right" aria-hidden="true" />
          <div className="subgraph-node-boundary-drag-surface subgraph-node-boundary-drag-surface--bottom" aria-hidden="true" />
          <div className="subgraph-node-boundary-drag-surface subgraph-node-boundary-drag-surface--left" aria-hidden="true" />
        </>
      )}
      <div className="subgraph-node-header subgraph-node-drag-surface">
        <div className="subgraph-node-heading">
          <span className="subgraph-node-indicator">Subgraph</span>
          <p className="subgraph-node-title">{data.label}</p>
        </div>
        <button
          type="button"
          className="subgraph-node-toggle nodrag nopan"
          disabled={removed || !data.collapseEditable}
          aria-expanded={!data.collapsed}
          aria-label={`${action} subgraph ${data.label}`}
          onPointerDownCapture={stopCanvasPointer}
          onKeyDownCapture={handleToggleKey}
          onClick={(event) => {
            event.stopPropagation();
            toggleCollapse();
          }}
        >
          {action}
        </button>
      </div>
      {!data.collapsed && (
        <p className="subgraph-node-description">Container for related workflow steps</p>
      )}
      {!removed && (
        <Handle
          type="source"
          position={Position.Right}
          className="subgraph-node-handle"
        />
      )}
    </div>
  );
}
