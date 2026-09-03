import { describe, expect, it } from 'vitest';

import type { CanvasEdgePresentation } from '@/src/adapters/react-flow/project-graph';
import type { GraphEdge, ProvenanceRepresentation } from '@/src/domain';
import { resolveRoutingEdgePresentation } from './routing-edge-presentation';

const nativeTokens: Record<
  GraphEdge['mode'],
  Pick<ReturnType<typeof resolveRoutingEdgePresentation>, 'color' | 'dasharray'>
> = {
  normal: { color: 'var(--gc-route-default)', dasharray: undefined },
  command: { color: 'var(--gc-route-command)', dasharray: '7 5' },
  conditional: { color: 'var(--gc-route-conditional)', dasharray: undefined },
  fallback: { color: 'var(--gc-route-fallback)', dasharray: '6 5' },
  send: { color: 'var(--gc-route-send)', dasharray: '7 5' },
};

const provenances: ProvenanceRepresentation[] = [
  'declared',
  'runtime-generated',
  'derived-semantic',
  'external-orchestration',
];

describe('resolveRoutingEdgePresentation', () => {
  it('keeps native mode strokes independent of provenance and frozen state', () => {
    for (const [mode, expected] of Object.entries(nativeTokens) as Array<[
      GraphEdge['mode'],
      (typeof nativeTokens)[GraphEdge['mode']],
    ]>) {
      for (const provenance of provenances) {
        for (const frozen of [false, true]) {
          const presentation: CanvasEdgePresentation = {
            mode,
            provenance,
            frozen,
            loop: false,
            invalid: false,
          };

          const resolved = resolveRoutingEdgePresentation(presentation);
          expect(resolved.color).toBe(expected.color);
          expect(resolved.dasharray).toBe(expected.dasharray);
        }
      }
    }
  });

  it('keeps topology-derived loop strokes independent of provenance and frozen state', () => {
    for (const provenance of provenances) {
      for (const frozen of [false, true]) {
        const resolved = resolveRoutingEdgePresentation({
          mode: 'command',
          provenance,
          frozen,
          loop: true,
          invalid: false,
        });
        expect(resolved.color).toBe('var(--gc-route-loop)');
        expect(resolved.dasharray).toBeUndefined();
      }
    }
  });
});
