'use client';

import { Edge, FitViewOptions, Node, useNodesInitialized, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

const BASE_FIT_VIEW_OPTIONS = {
  padding: { top: '10%' as const, right: '8%' as const, bottom: '12%' as const, left: '8%' as const },
  minZoom: 0.2,
  maxZoom: 1.15,
};

type CoalescedFitViewOptions = {
  enabled: boolean;
  revision: number;
  padding?: FitViewOptions['padding'];
};

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
>({ enabled, revision, padding = BASE_FIT_VIEW_OPTIONS.padding }: CoalescedFitViewOptions) {
  const { fitView } = useReactFlow<NodeType, EdgeType>();
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
    (animated = false) => {
      cancelScheduledFit();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null;
          void fitView({
            ...BASE_FIT_VIEW_OPTIONS,
            padding,
            duration: animated && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true ? 180 : 0,
          });
        });
      }, 48);
    },
    [cancelScheduledFit, fitView, padding],
  );

  useEffect(() => cancelScheduledFit, [cancelScheduledFit]);

  useEffect(() => {
    if (!enabled || !nodesInitialized || lastHandledRevisionRef.current === revision) return;
    lastHandledRevisionRef.current = revision;
    scheduleFit(false);
  }, [enabled, nodesInitialized, revision, scheduleFit]);

  return {
    fitGraph: useCallback(() => scheduleFit(true), [scheduleFit]),
  };
}
