import type { CanvasEdgePresentation } from '@/src/adapters/react-flow/project-graph';
import type { GraphEdge } from '@/src/domain';

export type RoutingEdgeTokens = Readonly<{
  color: string;
  haloColor: string;
  dasharray?: string;
  strokeWidth: number;
  opacity: number;
  animated: boolean;
}>;

const halo = (color: string, amount = 28) =>
  `color-mix(in srgb, ${color} ${amount}%, transparent)`;

/**
 * Phase one resolves canonical route semantics. Phase two adds transient
 * overlays: invalid may replace ink; proposal changes width/ghost opacity;
 * scenario/review focus and provenance stay secondary wrapper/label overlays.
 * Frozen is read-only only.
 */
export function resolveRoutingEdgePresentation(
  presentation: CanvasEdgePresentation,
): RoutingEdgeTokens {
  let semantic: RoutingEdgeTokens;
  if (presentation.runtimeInstance) {
    semantic = { color: 'var(--gc-route-send)', haloColor: halo('var(--gc-route-send)', 25), dasharray: '4 4', strokeWidth: 1.8, opacity: 1, animated: false };
  } else if (presentation.loop) {
    // A loop is derived from topology and remains the primary routing cue,
    // independent of how that edge's provenance was established.
    semantic = { color: 'var(--gc-route-loop)', haloColor: halo('var(--gc-route-loop)'), strokeWidth: 1.8, opacity: 1, animated: false };
  } else if (presentation.mode === 'command') {
    semantic = { color: 'var(--gc-route-command)', haloColor: halo('var(--gc-route-command)'), dasharray: '7 5', strokeWidth: 1.8, opacity: 1, animated: false };
  } else if (presentation.mode === 'conditional') {
    semantic = { color: 'var(--gc-route-conditional)', haloColor: halo('var(--gc-route-conditional)'), strokeWidth: 1.8, opacity: 1, animated: false };
  } else if (presentation.mode === 'fallback') {
    semantic = { color: 'var(--gc-route-fallback)', haloColor: halo('var(--gc-route-fallback)'), dasharray: '6 5', strokeWidth: 1.8, opacity: 1, animated: false };
  } else if (presentation.mode === 'send') {
    semantic = { color: 'var(--gc-route-send)', haloColor: halo('var(--gc-route-send)'), dasharray: '7 5', strokeWidth: 1.8, opacity: 1, animated: false };
  } else {
    semantic = { color: 'var(--gc-route-default)', haloColor: halo('var(--gc-focus)', 30), strokeWidth: 1.8, opacity: 1, animated: false };
  }

  if (presentation.invalid) {
    return { color: 'var(--gc-route-invalid)', haloColor: halo('var(--gc-route-invalid)', 30), dasharray: '4 3', strokeWidth: 2.5, opacity: 1, animated: false };
  }

  return {
    ...semantic,
    strokeWidth: presentation.proposalState ? 2.5 : semantic.strokeWidth,
    opacity: presentation.proposalState === 'removed' ? 0.65 : semantic.opacity,
    animated: presentation.proposalState === 'added',
  };
}

/** Canonical label fallback stays independent of transient visual state. */
export function resolveRoutingEdgeLabel(
  edge: Pick<GraphEdge, 'label' | 'mode'>,
  presentation: Pick<CanvasEdgePresentation, 'runtimeInstance'>,
): string | undefined {
  if (presentation.runtimeInstance) return undefined;
  return edge.label || (edge.mode === 'send' ? 'Send ×N' : edge.mode === 'fallback' ? 'fallback' : undefined);
}
