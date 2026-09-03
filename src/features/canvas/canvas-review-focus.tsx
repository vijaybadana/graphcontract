'use client';

import { createContext, type ReactNode, useContext } from 'react';

export type CanvasReviewFocus = {
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  contextNodeIds?: readonly string[];
  contextEdgeIds?: readonly string[];
  relationshipId: string | null;
};

export type CanvasReviewFocusState = 'active' | 'context' | 'dimmed' | null;

const CanvasReviewFocusContext = createContext<CanvasReviewFocus | null>(null);

/**
 * Proposal-detail focus is render-only UI state. Keeping it in the canvas
 * renderer avoids mixing review navigation into canonical graph selection or
 * relying on React Flow's internal controlled-node reconciliation.
 */
export function CanvasReviewFocusProvider({
  focus,
  children,
}: {
  focus: CanvasReviewFocus | null;
  children: ReactNode;
}) {
  return (
    <CanvasReviewFocusContext.Provider value={focus}>
      {children}
    </CanvasReviewFocusContext.Provider>
  );
}

export function useCanvasNodeReviewFocus(nodeId: string): CanvasReviewFocusState {
  const focus = useContext(CanvasReviewFocusContext);
  if (!focus) return null;
  if (focus.nodeIds.includes(nodeId)) return 'active';
  return focus.contextNodeIds?.includes(nodeId) ? 'context' : 'dimmed';
}

export function useCanvasEdgeReviewFocus(
  edgeIds: readonly string[],
  relationshipId: string | null = null,
): CanvasReviewFocusState {
  const focus = useContext(CanvasReviewFocusContext);
  if (!focus) return null;
  // A node review focuses the changed node only. Muting every route—or
  // emphasizing its incident routes—made unchanged topology look proposed.
  // Edge focus remains available for an actual edge/relationship review row.
  if (focus.nodeIds.length > 0 && focus.edgeIds.length === 0 && !focus.relationshipId) {
    return null;
  }
  const active = relationshipId
    ? focus.relationshipId === relationshipId
    : edgeIds.some((edgeId) => focus.edgeIds.includes(edgeId));
  if (active) return 'active';
  return !relationshipId && edgeIds.some((edgeId) => focus.contextEdgeIds?.includes(edgeId))
    ? 'context'
    : 'dimmed';
}
