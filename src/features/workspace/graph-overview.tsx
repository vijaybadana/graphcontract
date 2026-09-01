'use client';

import { MiniMap, type MiniMapNodeProps, useReactFlow } from '@xyflow/react';
import { useCallback, type MouseEvent } from 'react';

import type { CanvasFlowNode } from '@/src/features/canvas/canvas-node';

import './graph-overview.css';

const stepColors = {
  ai: '#c8752d',
  deterministic: '#64748b',
  human: '#e11d48',
  tool: '#0284c7',
} as const;

function overviewNodeColor(node: CanvasFlowNode) {
  if (node.type === 'contractNode') {
    if (node.data.kind === 'start') return '#059669';
    if (node.data.kind === 'end') return '#475569';
    if (node.data.kind === 'merge') return '#526477';
    return stepColors[node.data.executor];
  }
  if (node.type === 'mergeJunction') return '#526477';
  if (node.type === 'runtimeInstance') return '#5969c8';
  if (node.type === 'externalSystemTile') return '#64748b';
  return '#5c8f7d';
}

/**
 * Minimap geometry should communicate topology, not reproduce full card or
 * expanded-subgraph dimensions. Centering a bounded mark on each projected
 * node keeps large containers from reading as overlapping panels.
 */
export function GraphOverviewNode({
  id,
  x,
  y,
  width,
  height,
  color,
  selected,
}: MiniMapNodeProps) {
  const markWidth = Math.max(80, Math.min(width, 180));
  const markHeight = Math.max(40, Math.min(height, 90));

  return (
    <rect
      className={`graph-overview-node${selected ? ' is-selected' : ''}`}
      data-overview-node-id={id}
      x={x + (width - markWidth) / 2}
      y={y + (height - markHeight) / 2}
      width={markWidth}
      height={markHeight}
      rx={8}
      ry={8}
      fill={color ?? '#64748b'}
      stroke="#ffffff"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function GraphOverview() {
  const { getZoom, setCenter } = useReactFlow();
  const navigateTo = useCallback(
    (_event: MouseEvent, position: { x: number; y: number }) => {
      void setCenter(position.x, position.y, { zoom: getZoom() });
    },
    [getZoom, setCenter],
  );

  return (
    <>
      <div className="canvas-minimap-title" aria-hidden="true">
        Graph overview
      </div>
      <MiniMap<CanvasFlowNode>
        ariaLabel="Graph overview navigator. Drag or click to pan; scroll to zoom."
        pannable
        zoomable
        onClick={navigateTo}
        position="bottom-left"
        nodeColor={overviewNodeColor}
        nodeComponent={GraphOverviewNode}
        bgColor="#f8faf9"
        maskColor="rgb(15 23 42 / 10%)"
        maskStrokeColor="#315b4f"
        maskStrokeWidth={1.8}
        className="canvas-minimap"
      />
    </>
  );
}
