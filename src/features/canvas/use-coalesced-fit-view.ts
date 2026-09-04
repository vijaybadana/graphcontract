'use client';

import { Edge, FitViewOptions, Node, useNodesInitialized, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

const BASE_FIT_VIEW_OPTIONS = {
  padding: { top: '10%' as const, right: '8%' as const, bottom: '12%' as const, left: '8%' as const },
  minZoom: 0.48,
  maxZoom: 1.15,
};

type CoalescedFitViewOptions = {
  enabled: boolean;
  revision: number;
  padding?: FitViewOptions['padding'];
  minZoom?: number;
};

/**
 * Expanded subgraphs are background containers. When they already have visible
 * members, fitting their full rectangle can make the authored nodes microscopic.
 * Child nodes retain absolute measured bounds in React Flow, so they are the
 * meaningful fit targets. Empty groups remain targets so they are never lost.
 */
export function readableFitNodeIds(nodes: readonly Node[]) {
  const visibleNodes = nodes.filter((node) => node.hidden !== true);
  const visibleParentIds = new Set(
    visibleNodes.flatMap((node) => node.parentId ? [node.parentId] : []),
  );
  return visibleNodes
    .filter((node) => !(
      node.type === 'subgraph' &&
      node.data?.collapsed === false &&
      visibleParentIds.has(node.id)
    ))
    .map((node) => node.id);
}

/**
 * Large declared worker templates are authored as one readable compound frame.
 * They need a wider fit range than ordinary graphs, especially while the
 * inventory inset is open. Keep the established desktop floor everywhere
 * else so normal workflows do not become unnecessarily small.
 */
export function readableFitMinZoom(nodes: readonly Node[], configuredMinZoom: number) {
  const containsLargeDeclaredTemplate = nodes.some((node) =>
    node.type === 'dynamicWorkerGroup' &&
    node.hidden !== true &&
    Math.max(node.width ?? 0, node.initialWidth ?? 0) >= 960,
  );
  return containsLargeDeclaredTemplate ? Math.min(configuredMinZoom, 0.32) : configuredMinZoom;
}

/**
 * Keeps viewport fitting outside React Flow's node ResizeObserver cycle.
 * Automatic fits are non-animated so multiple measurement passes cannot overlap
 * animated viewport updates. Manual fits retain a short animation. Container
 * resizes deliberately do not trigger a fit, preserving the user's viewport
 * when workspace panels open or close.
 */
export function useCoalescedFitView<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>({
  enabled,
  revision,
  padding = BASE_FIT_VIEW_OPTIONS.padding,
  minZoom = BASE_FIT_VIEW_OPTIONS.minZoom,
}: CoalescedFitViewOptions) {
  const { fitView, getNodes } = useReactFlow<NodeType, EdgeType>();
  const nodesInitialized = useNodesInitialized();
  const timeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastHandledRevisionRef = useRef<number | null>(null);

  const cancelScheduledFit = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (frameRef.current === null) return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const scheduleFit = useCallback(
    (
      animated = false,
      requestedNodeIds?: readonly string[],
      settleDelay = 48,
      zoomOverride?: Pick<FitViewOptions, 'minZoom' | 'maxZoom'>,
    ) => {
      cancelScheduledFit();
      const scheduleAttempt = (attempt: number) => {
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          frameRef.current = window.requestAnimationFrame(() => {
            frameRef.current = null;
            const nodes = getNodes();
            const availableIds = new Set(nodes.map((node) => node.id));
            const requestedIdsReady = requestedNodeIds?.every((id) => availableIds.has(id)) ?? true;
            if (!requestedIdsReady && attempt < 8) {
              scheduleAttempt(attempt + 1);
              return;
            }
            const nodeIds = requestedNodeIds
              ? requestedNodeIds.filter((id) => availableIds.has(id))
              : readableFitNodeIds(nodes);
            void fitView({
              ...BASE_FIT_VIEW_OPTIONS,
              padding,
              minZoom: zoomOverride?.minZoom ?? readableFitMinZoom(nodes, minZoom),
              maxZoom: zoomOverride?.maxZoom ?? BASE_FIT_VIEW_OPTIONS.maxZoom,
              nodes: nodeIds.map((id) => ({ id })),
              duration: animated && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true ? 180 : 0,
            });
          });
        }, attempt === 0 ? settleDelay : 48);
      };
      scheduleAttempt(0);
    },
    [cancelScheduledFit, fitView, getNodes, minZoom, padding],
  );

  useEffect(() => cancelScheduledFit, [cancelScheduledFit]);

  useEffect(() => {
    if (!enabled || !nodesInitialized || lastHandledRevisionRef.current === revision) return;
    lastHandledRevisionRef.current = revision;
    scheduleFit(false);
  }, [enabled, nodesInitialized, revision, scheduleFit]);

  return {
    fitGraph: useCallback(() => scheduleFit(true), [scheduleFit]),
    /** Fits an explicit authored path through the same panel-aware viewport. */
    fitNodes: useCallback((nodeIds: readonly string[]) => {
      if (!enabled || nodeIds.length === 0) return false;
      // Explicit path fitting prioritizes keeping the complete authored path
      // inside the usable canvas. Large/nested workflows can span much wider
      // than the general graph readability floor allows, especially with an
      // inspector rail open. The canvas itself already supports this minimum;
      // short paths still resolve to their natural (larger) fit zoom.
      scheduleFit(true, nodeIds, 48, { minZoom: 0.08, maxZoom: BASE_FIT_VIEW_OPTIONS.maxZoom });
      return true;
    }, [enabled, scheduleFit]),
    /** Fits proposal-review targets with a modest readable detail zoom. */
    fitFocus: useCallback((nodeIds: readonly string[], detail = false) => {
      if (!enabled || nodeIds.length === 0) return false;
      scheduleFit(
        true,
        nodeIds,
        48,
        detail ? { minZoom: 0.62, maxZoom: 0.84 } : undefined,
      );
      return true;
    }, [enabled, scheduleFit]),
    /**
     * Projection swaps can replace every rendered bound while preserving the
     * canonical graph. Only acknowledge the request once React Flow has
     * measured the replacement projection; the caller can retry on the next
     * render while this returns false.
     */
    fitProjection: useCallback((expectedNodes: readonly NodeType[]) => {
      if (!enabled) return false;
      // The panel entrance animation and React Flow's controlled-node sync both
      // complete within this bounded settle window. The fit then runs once.
      scheduleFit(false, readableFitNodeIds(expectedNodes), 220);
      return true;
    }, [enabled, scheduleFit]),
  };
}
