import { describe, expect, it } from 'vitest';

import { createDraftEdge, evaluateConnection } from './connection-policy';
import { sampleGraph } from '@/src/domain';

describe('evaluateConnection', () => {
  it('prevents cycles, Start inputs, End outputs, and duplicate routes', () => {
    expect(
      evaluateConnection(
        sampleGraph,
        { source: 'refund', target: 'classifier' },
        { reconnectingEdgeId: 'refund-end' },
      ).code,
    ).toBe('CYCLE_DETECTED');
    expect(evaluateConnection(sampleGraph, { source: 'end', target: 'billing' }).code).toBe(
      'END_OUTGOING',
    );
    expect(evaluateConnection(sampleGraph, { source: 'billing', target: 'start' }).code).toBe(
      'START_INCOMING',
    );
    expect(evaluateConnection(sampleGraph, { source: 'billing', target: 'refund' }).code).toBe(
      'DUPLICATE_CONNECTION',
    );
  });

  it('allows reconnecting a normal edge without counting the old route', () => {
    const decision = evaluateConnection(
      sampleGraph,
      { source: 'billing', target: 'end' },
      { reconnectingEdgeId: 'billing-refund' },
    );

    expect(decision).toEqual({ valid: true });
  });

  it('creates labelled conditional draft edges after routing becomes conditional', () => {
    const edge = createDraftEdge(sampleGraph, 'new-edge', 'classifier', 'end');

    expect(edge.mode).toBe('conditional');
    expect(edge.label).toBe('branch 4');
  });
});
