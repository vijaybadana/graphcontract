'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';

import { GraphSubgraph } from '@/src/domain';
import './subgraph-node.css';

export type SubgraphNodeData = GraphSubgraph & {
  /**
   * The canvas projection accepts this callback without owning the workspace
   * mutation. The workspace seam supplies it when subgraph editing is wired.
   */
  onToggleCollapse?: (subgraphId: string, collapsed: boolean) => void;
  [key: string]: unknown;
};

export type SubgraphFlowNode = Node<SubgraphNodeData, 'subgraph'>;

export function SubgraphNode({ data, selected }: NodeProps<SubgraphFlowNode>) {
  const action = data.collapsed ? 'Expand' : 'Collapse';

  return (
    <div
      className={`subgraph-node-shell ${data.collapsed ? 'is-collapsed' : 'is-expanded'} ${selected ? 'is-selected' : ''}`}
      data-collapsed={data.collapsed}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="subgraph-node-handle"
      />
      <div className="subgraph-node-header">
        <div className="subgraph-node-heading">
          <span className="subgraph-node-indicator">Subgraph</span>
          <p className="subgraph-node-title">{data.label}</p>
        </div>
        <button
          type="button"
          className="subgraph-node-toggle nodrag nopan"
          aria-expanded={!data.collapsed}
          aria-label={`${action} subgraph ${data.label}`}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleCollapse?.(data.id, !data.collapsed);
          }}
        >
          {action}
        </button>
      </div>
      {!data.collapsed && (
        <p className="subgraph-node-description">Container for related workflow steps</p>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="subgraph-node-handle"
      />
    </div>
  );
}
