'use client';

import {
  MiniMap,
  type MiniMapNodeProps,
  useNodes,
  useReactFlow,
  useStore,
  useViewport,
} from '@xyflow/react';
import { useCallback, useMemo, type MouseEvent } from 'react';

import type { CanvasFlowNode } from '@/src/features/canvas/canvas-node';

import './graph-overview.css';

const stepColors = {
  ai: '#c8752d',
  deterministic: '#64748b',
  human: '#e11d48',
  tool: '#0284c7',
} as const;
const overviewWidth = 154;
const overviewHeight = 88;
const overviewOffsetScale = 5;

type Rect = { x: number; y: number; width: number; height: number };

function unionRects(first: Rect, second: Rect): Rect {
  const x = Math.min(first.x, second.x);
  const y = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return { x, y, width: right - x, height: bottom - y };
}

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

/**
 * React Flow's stock minimap mask is one compound path. Stroking it outlines
 * both the outer map bounds and the viewport, which reads as two competing
 * boxes. This overlay recreates the same viewBox and draws only the viewport.
 */
function GraphOverviewViewport() {
  const nodes = useNodes<CanvasFlowNode>();
  const viewport = useViewport();
  const flowWidth = useStore((state) => state.width);
  const flowHeight = useStore((state) => state.height);
  const { getNodesBounds } = useReactFlow<CanvasFlowNode>();

  const geometry = useMemo(() => {
    const view = {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      width: flowWidth / viewport.zoom,
      height: flowHeight / viewport.zoom,
    };
    const visibleNodes = nodes.filter((node) => !node.hidden);
    const graphBounds = visibleNodes.length > 0 ? getNodesBounds(visibleNodes) : view;
    const bounds = unionRects(graphBounds, view);
    const viewScale = Math.max(
      bounds.width / overviewWidth,
      bounds.height / overviewHeight,
    );
    const offset = overviewOffsetScale * viewScale;
    const width = viewScale * overviewWidth + offset * 2;
    const height = viewScale * overviewHeight + offset * 2;

    return {
      view,
      viewBox: `${bounds.x - (viewScale * overviewWidth - bounds.width) / 2 - offset} ${
        bounds.y - (viewScale * overviewHeight - bounds.height) / 2 - offset
      } ${width} ${height}`,
    };
  }, [flowHeight, flowWidth, getNodesBounds, nodes, viewport]);

  return (
    <svg
      aria-hidden="true"
      className="canvas-minimap-viewport-overlay"
      viewBox={geometry.viewBox}
    >
      <rect
        className="graph-overview-viewport"
        data-testid="graph-overview-viewport"
        x={geometry.view.x}
        y={geometry.view.y}
        width={geometry.view.width}
        height={geometry.view.height}
        rx={4}
        ry={4}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
        maskStrokeColor="transparent"
        maskStrokeWidth={0}
        offsetScale={overviewOffsetScale}
        style={{ width: overviewWidth, height: overviewHeight }}
        className="canvas-minimap"
      />
      <GraphOverviewViewport />
    </>
  );
}
