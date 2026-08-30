import { WorkflowGraph } from '@/src/domain';
import { describe, expect, it } from 'vitest';

import { CONTRACT_NODE_HEIGHT, CONTRACT_NODE_WIDTH } from './canvas-geometry';
import { layoutWorkflowGraph } from './layout-workflow';

const graph = (
  nodes: WorkflowGraph['nodes'],
  edges: WorkflowGraph['edges'],
  subgraphs: WorkflowGraph['subgraphs'] = [],
): WorkflowGraph => ({
  id: 'layout-fixture',
  name: 'Layout fixture',
  schemaVersion: '4',
  status: 'draft',
  updatedAt: '2026-08-31T00:00:00.000Z',
  nodes,
  edges,
  subgraphs,
});

const step = (id: string, x: number, y: number, parentId?: string) => ({
  id,
  kind: 'step' as const,
  label: id,
  executor: 'deterministic' as const,
  position: { x, y },
  ...(parentId ? { parentId } : {}),
});

describe('layoutWorkflowGraph', () => {
  it('is immutable and deterministically orders conditional branch lanes', () => {
    const input = graph(
      [
        { id: 'start', kind: 'start', label: 'Start', position: { x: 900, y: 900 } },
        step('route', 40, 40),
        step('zeta', 30, 30),
        step('alpha', 20, 20),
        { id: 'end', kind: 'end', label: 'End', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'start-route', source: 'start', target: 'route', mode: 'normal' },
        { id: 'route-zeta', source: 'route', target: 'zeta', mode: 'conditional', label: 'zeta', condition: 'route.zeta' },
        { id: 'route-alpha', source: 'route', target: 'alpha', mode: 'conditional', label: 'alpha', condition: 'route.alpha' },
        { id: 'alpha-end', source: 'alpha', target: 'end', mode: 'normal' },
        { id: 'zeta-end', source: 'zeta', target: 'end', mode: 'normal' },
      ],
    );
    const original = structuredClone(input);

    const first = layoutWorkflowGraph(input);
    const second = layoutWorkflowGraph(structuredClone(input));
    const byId = new Map(first.nodes.map((node) => [node.id, node]));

    expect(input).toEqual(original);
    expect(first).toEqual(second);
    expect(first.edges).toEqual(input.edges);
    expect(byId.get('start')!.position.x).toBeLessThan(byId.get('route')!.position.x);
    expect(byId.get('route')!.position.x).toBeLessThan(byId.get('alpha')!.position.x);
    expect(byId.get('alpha')!.position.y).toBeLessThan(byId.get('zeta')!.position.y);
    expect(byId.get('alpha')!.position.x).toBeLessThan(byId.get('end')!.position.x);
  });

  it('lays subgraph children in relative coordinates and derives containing dimensions', () => {
    const input = graph(
      [
        { id: 'start', kind: 'start', label: 'Start', position: { x: 0, y: 0 } },
        { id: 'cell-start', kind: 'start', label: 'Cell start', parentId: 'cell', position: { x: 800, y: 900 } },
        step('cell-work', 700, 900, 'cell'),
        { id: 'cell-end', kind: 'end', label: 'Cell end', parentId: 'cell', position: { x: 600, y: 900 } },
        { id: 'end', kind: 'end', label: 'End', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'enter-cell', source: 'start', target: 'cell-start', mode: 'normal' },
        { id: 'cell-work', source: 'cell-start', target: 'cell-work', mode: 'normal' },
        { id: 'leave-cell', source: 'cell-work', target: 'cell-end', mode: 'normal' },
        { id: 'cell-exit', source: 'cell-end', target: 'end', mode: 'normal' },
      ],
      [{ id: 'cell', label: 'Cell', position: { x: 500, y: 900 }, dimensions: { width: 40, height: 40 }, collapsed: false }],
    );

    const laidOut = layoutWorkflowGraph(input);
    const cell = laidOut.subgraphs[0]!;
    const byId = new Map(laidOut.nodes.map((node) => [node.id, node]));

    expect(byId.get('cell-start')!.parentId).toBe('cell');
    expect(byId.get('cell-work')!.position.x).toBeGreaterThan(byId.get('cell-start')!.position.x);
    expect(byId.get('cell-end')!.position.x).toBeGreaterThan(byId.get('cell-work')!.position.x);
    expect(byId.get('cell-start')!.position.x).toBeLessThan(cell.position.x);
    expect(cell.dimensions.width).toBeGreaterThanOrEqual(byId.get('cell-end')!.position.x + CONTRACT_NODE_WIDTH + 36);
    expect(cell.dimensions.height).toBeGreaterThanOrEqual(byId.get('cell-end')!.position.y + CONTRACT_NODE_HEIGHT + 36);
    expect(byId.get('start')!.position.x).toBeLessThan(cell.position.x);
    expect(cell.position.x).toBeLessThan(byId.get('end')!.position.x);
  });

  it('keeps Send, Merge, and bounded return topology in stable lanes without changing endpoints', () => {
    const input = graph(
      [
        { id: 'start', kind: 'start', label: 'Start', position: { x: 0, y: 0 } },
        step('dispatch', 0, 0),
        step('worker', 0, 0),
        {
          id: 'merge',
          kind: 'merge',
          label: 'Merge',
          position: { x: 0, y: 0 },
          merge: {
            reducer: { name: 'collect', aggregateState: 'results' },
            completion: { mode: 'all' },
            continuation: { mode: 'once' },
            waitingForDynamicInputs: true,
          },
        },
        step('review', 0, 0),
        { id: 'end', kind: 'end', label: 'End', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'start-dispatch', source: 'start', target: 'dispatch', mode: 'normal' },
        { id: 'send-worker', source: 'dispatch', target: 'worker', mode: 'send', send: { destinationTemplateId: 'worker', multiplicity: 'dynamic', payloadLabel: 'item', mergeNodeId: 'merge' } },
        { id: 'worker-merge', source: 'worker', target: 'merge', mode: 'normal' },
        { id: 'merge-review', source: 'merge', target: 'review', mode: 'normal' },
        { id: 'review-end', source: 'review', target: 'end', mode: 'conditional', label: 'complete', condition: 'review.complete' },
        { id: 'review-dispatch', source: 'review', target: 'dispatch', mode: 'conditional', label: 'refine', condition: 'review.refine', loopCap: 2 },
      ],
    );
    const originalEdges = structuredClone(input.edges);

    const laidOut = layoutWorkflowGraph(input);
    const byId = new Map(laidOut.nodes.map((node) => [node.id, node]));

    expect(laidOut.edges).toEqual(originalEdges);
    expect(byId.get('dispatch')!.position.x).toBeLessThan(byId.get('worker')!.position.x);
    expect(byId.get('worker')!.position.x).toBeLessThan(byId.get('merge')!.position.x);
    expect(byId.get('merge')!.position.x).toBeLessThan(byId.get('review')!.position.x);
    expect(byId.get('dispatch')!.position.y).toBeLessThan(byId.get('review')!.position.y);
    expect(byId.get('worker')!.position.y).toBe(byId.get('merge')!.position.y);
  });
});
