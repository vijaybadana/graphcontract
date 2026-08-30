'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { EyeIcon, StackIcon } from '@phosphor-icons/react';

import './runtime-instance-node.css';

/** Runtime-only data. This shape intentionally does not include a GraphNode. */
export type RuntimeInstanceNodeData = {
  runtimeId: string;
  sendEdgeId: string;
  templateNodeId: string;
  label: string;
  ordinal: number;
  [key: string]: unknown;
};

export type RuntimeInstanceFlowNode = Node<RuntimeInstanceNodeData, 'runtimeInstance'>;

export function RuntimeInstanceNode({ data, selected }: NodeProps<RuntimeInstanceFlowNode>) {
  return (
    <div
      className={`runtime-instance-node ${selected ? 'is-selected' : ''}`}
      data-runtime-id={data.runtimeId}
      data-template-node-id={data.templateNodeId}
    >
      <Handle type="target" position={Position.Left} className="runtime-instance-node__handle" />
      <span className="runtime-instance-node__icon" aria-hidden="true"><StackIcon size={16} weight="bold" /></span>
      <span className="runtime-instance-node__copy">
        <span className="runtime-instance-node__eyebrow">Observed instance #{data.ordinal}</span>
        <strong>{data.label}</strong>
      </span>
      <EyeIcon className="runtime-instance-node__read-only" size={15} weight="bold" aria-label="Read-only runtime instance" />
      <Handle type="source" position={Position.Right} className="runtime-instance-node__handle" />
    </div>
  );
}
