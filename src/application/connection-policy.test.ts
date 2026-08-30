import { describe, expect, it } from 'vitest';

import { createDraftEdge, evaluateConnection } from './connection-policy';
import { sampleGraph, WorkflowGraph } from '@/src/domain';

describe('evaluateConnection', () => {
  it('accepts a derived cycle while preserving Start, End, and duplicate-route constraints', () => {
    expect(
      evaluateConnection(
        sampleGraph,
        { source: 'refund', target: 'classifier' },
        { reconnectingEdgeId: 'refund-end' },
      ),
    ).toEqual({ valid: true });
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

  it('keeps internal Start and End nodes as the only permitted subgraph boundary routes', () => {
    const graph: WorkflowGraph = {
      schemaVersion: '3',
      id: 'subgraph-boundaries',
      name: 'Subgraph boundaries',
      status: 'draft',
      updatedAt: '2026-08-30T00:00:00.000Z',
      subgraphs: [
        {
          id: 'review',
          label: 'Review',
          position: { x: 200, y: 80 },
          dimensions: { width: 640, height: 380 },
          collapsed: false,
        },
      ],
      nodes: [
        { id: 'start', kind: 'start', label: 'Start', position: { x: 20, y: 200 } },
        { id: 'outer', kind: 'step', executor: 'ai', label: 'Outer', position: { x: 120, y: 200 } },
        { id: 'inner-start', kind: 'start', label: 'Inner start', parentId: 'review', position: { x: 40, y: 100 } },
        { id: 'inner', kind: 'step', executor: 'ai', label: 'Inner', parentId: 'review', position: { x: 220, y: 100 } },
        { id: 'inner-end', kind: 'end', label: 'Inner end', parentId: 'review', position: { x: 400, y: 100 } },
        { id: 'end', kind: 'end', label: 'End', position: { x: 980, y: 200 } },
      ],
      edges: [],
    };

    expect(evaluateConnection(graph, { source: 'outer', target: 'inner-start' })).toEqual({ valid: true });
    expect(evaluateConnection(graph, { source: 'inner-end', target: 'outer' })).toEqual({ valid: true });
    expect(evaluateConnection(graph, { source: 'outer', target: 'inner' }).code).toBe(
      'INVALID_SUBGRAPH_ENTRY',
    );
    expect(evaluateConnection(graph, { source: 'inner', target: 'outer' }).code).toBe(
      'INVALID_SUBGRAPH_EXIT',
    );
    expect(evaluateConnection(graph, { source: 'inner-end', target: 'inner' }).code).toBe(
      'INVALID_SUBGRAPH_EXIT',
    );
  });
});
