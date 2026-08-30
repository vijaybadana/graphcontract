'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { GlobeHemisphereWestIcon } from '@phosphor-icons/react';

import './external-system-tile.css';

/** A deterministic canvas-only boundary endpoint for a non-native relationship. */
export type ExternalSystemTileData = {
  externalId: string;
  label: string;
  [key: string]: unknown;
};

export type ExternalSystemTileFlowNode = Node<
  ExternalSystemTileData,
  'externalSystemTile'
>;

export function ExternalSystemTile({ data }: NodeProps<ExternalSystemTileFlowNode>) {
  return (
    <div className="external-system-tile" data-external-id={data.externalId}>
      <Handle type="target" position={Position.Left} className="external-system-tile__handle" />
      <span className="external-system-tile__icon" aria-hidden="true">
        <GlobeHemisphereWestIcon size={19} weight="bold" />
      </span>
      <span className="external-system-tile__copy">
        <span>External system</span>
        <strong>{data.label}</strong>
      </span>
      <Handle type="source" position={Position.Right} className="external-system-tile__handle" />
    </div>
  );
}
