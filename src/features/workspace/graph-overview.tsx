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
  ai: 'var(--gc-node-ai-accent)',
  deterministic: 'var(--gc-node-end-accent)',
  human: 'var(--gc-node-human-accent)',
  tool: 'var(--gc-node-tool-accent)',
} as const;
const overviewWidth = 154;
const overviewHeight = 88;
const overviewOffsetScale = 5;

type Rect = { x: number; y: number; width: number; height: number };

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

function unionRects(first: Rect, second: Rect): Rect {
  const x = Math.min(first.x, second.x);
  const y = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return { x, y, width: right - x, height: bottom - y };
}

function overviewNodeColor(node: CanvasFlowNode) {
  if (node.type === 'contractNode') {
    if (node.data.kind === 'start') return 'var(--gc-node-start-accent)';
    if (node.data.kind === 'end') return 'var(--gc-node-end-accent)';
    if (node.data.kind === 'merge') return '#526477';
    return stepColors[node.data.executor];
  }
  if (node.type === 'mergeJunction') return '#526477';
  if (node.type === 'runtimeInstance') return '#5969c8';
  if (node.type === 'externalSystemTile') return 'var(--gc-node-end-accent)';
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
  const safeX = finiteOr(x, 0);
  const safeY = finiteOr(y, 0);
  const safeWidth = Math.max(0, finiteOr(width, 0));
  const safeHeight = Math.max(0, finiteOr(height, 0));
  const markWidth = Math.max(80, Math.min(safeWidth, 180));
  const markHeight = Math.max(40, Math.min(safeHeight, 90));

  return (
    <rect
      className={`graph-overview-node${selected ? ' is-selected' : ''}`}
      data-overview-node-id={id}
      x={safeX + (safeWidth - markWidth) / 2}
      y={safeY + (safeHeight - markHeight) / 2}
      width={markWidth}
      height={markHeight}
      rx={8}
      ry={8}
      fill={color ?? 'var(--gc-node-end-accent)'}
      stroke="var(--gc-surface)"
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
    // React Flow can expose a zero zoom and unmeasured dimensions for one
    // render while a compact canvas mounts. Keep SVG geometry finite so that
    // the overview never emits invalid coordinates during that transition.
    const zoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
    const view = {
      x: -finiteOr(viewport.x, 0) / zoom,
      y: -finiteOr(viewport.y, 0) / zoom,
      width: finiteOr(flowWidth, 0) / zoom,
      height: finiteOr(flowHeight, 0) / zoom,
    };
    const visibleNodes = nodes.filter((node) => !node.hidden);
    const measuredBounds = visibleNodes.length > 0 ? getNodesBounds(visibleNodes) : view;
    const graphBounds = {
      x: finiteOr(measuredBounds.x, view.x),
      y: finiteOr(measuredBounds.y, view.y),
      width: finiteOr(measuredBounds.width, view.width),
      height: finiteOr(measuredBounds.height, view.height),
    };
    const bounds = unionRects(graphBounds, view);
    const viewScale = Math.max(1,
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
      <MiniMap<CanvasFlowNode>
        ariaLabel="Graph overview navigator. Drag or click to pan; scroll to zoom."
        pannable
        zoomable
        onClick={navigateTo}
        position="bottom-left"
        nodeColor={overviewNodeColor}
        nodeComponent={GraphOverviewNode}
        bgColor="var(--gc-surface-subtle)"
        maskColor="color-mix(in srgb, var(--gc-ink-strong) 10%, transparent)"
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
