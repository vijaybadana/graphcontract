'use client';

import { Edge, Node, useNodesInitialized, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

const BASE_FIT_VIEW_OPTIONS = {
  padding: { top: '10%' as const, right: '8%' as const, bottom: '12%' as const, left: '8%' as const },
  minZoom: 0.2,
  maxZoom: 1.15,
};

type CoalescedFitViewOptions = {
  enabled: boolean;
  revision: number;
  containerLayoutKey: string;
};

/**
 * Keeps viewport fitting outside React Flow's node ResizeObserver cycle.
 * Automatic fits are non-animated so multiple measurement passes cannot overlap
 * animated viewport updates. Manual fits retain a short animation.
 */
export function useCoalescedFitView<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>({ enabled, revision, containerLayoutKey }: CoalescedFitViewOptions) {
  const { fitView } = useReactFlow<NodeType, EdgeType>();
  const nodesInitialized = useNodesInitialized();
  const timeoutRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastHandledRevisionRef = useRef<number | null>(null);
  const lastHandledContainerLayoutKeyRef = useRef(containerLayoutKey);

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
            duration: animated ? 180 : 0,
          });
        });
      }, 48);
    },
    [cancelScheduledFit, fitView],
  );

  useEffect(() => cancelScheduledFit, [cancelScheduledFit]);

  useEffect(() => {
    if (!enabled || !nodesInitialized || lastHandledRevisionRef.current === revision) return;
    lastHandledRevisionRef.current = revision;
    scheduleFit(false);
  }, [enabled, nodesInitialized, revision, scheduleFit]);

  useEffect(() => {
    if (
      !enabled ||
      !nodesInitialized ||
      lastHandledContainerLayoutKeyRef.current === containerLayoutKey
    ) {
      return;
    }
    lastHandledContainerLayoutKeyRef.current = containerLayoutKey;
    scheduleFit(false);
  }, [containerLayoutKey, enabled, nodesInitialized, scheduleFit]);

  return {
    fitGraph: useCallback(() => scheduleFit(true), [scheduleFit]),
  };
}
