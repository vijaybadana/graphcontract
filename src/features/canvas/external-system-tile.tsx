'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { GlobeHemisphereWestIcon } from '@phosphor-icons/react';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
} from '@/src/application/layout-workflow';
import { useCanvasNodeReviewFocus } from './canvas-review-focus';

import './external-system-tile.css';
import './node-boundary.css';

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

export function ExternalSystemTile({ data, id }: NodeProps<ExternalSystemTileFlowNode>) {
  const reviewFocusState = useCanvasNodeReviewFocus(id);
  return (
    <div className={`external-system-tile ${reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''}`} data-external-id={data.externalId}>
      <Handle id={CANVAS_INPUT_PORT_ID} type="target" position={Position.Left} className="external-system-tile__handle" />
      <span className="external-system-tile__icon" aria-hidden="true">
        <GlobeHemisphereWestIcon size={19} weight="bold" />
      </span>
      <span className="external-system-tile__copy">
        <span>External system</span>
        <strong>{data.label}</strong>
      </span>
      <Handle id={CANVAS_OUTPUT_PORT_ID} type="source" position={Position.Right} className="external-system-tile__handle" />
    </div>
  );
}
