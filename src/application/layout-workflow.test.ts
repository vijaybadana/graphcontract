import { createDefaultGraphCapabilities, WorkflowGraph } from '@/src/domain';
import { describe, expect, it } from 'vitest';

import { CONTRACT_NODE_HEIGHT, CONTRACT_NODE_WIDTH } from './canvas-geometry';
import {
  CompoundLayoutNode,
  layoutCompoundGeometry,
  layoutWorkflowGraph,
  toElkCompoundGraph,
} from './layout-workflow';

const graph = (
  nodes: WorkflowGraph['nodes'],
  edges: WorkflowGraph['edges'],
  subgraphs: WorkflowGraph['subgraphs'] = [],
): WorkflowGraph => ({
  id: 'layout-fixture',
  name: 'Layout fixture',
  schemaVersion: '6',
  status: 'draft',
  updatedAt: '2026-08-31T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  nodes,
  edges,
  subgraphs,
  relationships: [],
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
  it('is immutable and deterministically orders conditional branch lanes', async () => {
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

    const first = await layoutWorkflowGraph(input);
    const second = await layoutWorkflowGraph(structuredClone(input));
    const byId = new Map(first.nodes.map((node) => [node.id, node]));

    expect(input).toEqual(original);
    expect(first).toEqual(second);
    expect(first.edges).toEqual(input.edges);
    expect(byId.get('start')!.position.x).toBeLessThan(byId.get('route')!.position.x);
    expect(byId.get('route')!.position.x).toBeLessThan(byId.get('alpha')!.position.x);
    expect(byId.get('alpha')!.position.y).toBeLessThan(byId.get('zeta')!.position.y);
    expect(byId.get('alpha')!.position.x).toBeLessThan(byId.get('end')!.position.x);
  });

  it('lays subgraph children in relative coordinates and derives containing dimensions', async () => {
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

    const laidOut = await layoutWorkflowGraph(input);
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

  it('keeps Send, Merge, and bounded return topology in stable lanes without changing endpoints', async () => {
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

    const laidOut = await layoutWorkflowGraph(input);
    const byId = new Map(laidOut.nodes.map((node) => [node.id, node]));

    expect(laidOut.edges).toEqual(originalEdges);
    expect(byId.get('dispatch')!.position.x).toBeLessThan(byId.get('worker')!.position.x);
    expect(byId.get('worker')!.position.x).toBeLessThan(byId.get('merge')!.position.x);
    expect(byId.get('merge')!.position.x).toBeLessThan(byId.get('review')!.position.x);
    expect(byId.get('worker')!.position.y).toBeGreaterThanOrEqual(0);
  });

  it('round-trips exact expanded dimensions through collapse and reopen unless recomputation is explicit', async () => {
    const expandedDimensions = { width: 980, height: 620 };
    const input = graph(
      [
        { id: 'start', kind: 'start', label: 'Start', position: { x: 0, y: 0 } },
        step('inside', 180, 220, 'cell'),
        { id: 'end', kind: 'end', label: 'End', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'enter', source: 'start', target: 'inside', mode: 'normal' },
        { id: 'leave', source: 'inside', target: 'end', mode: 'normal' },
      ],
      [{ id: 'cell', label: 'Cell', position: { x: 500, y: 500 }, dimensions: expandedDimensions, collapsed: false }],
    );

    const expanded = await layoutWorkflowGraph(input);
    expect(expanded.subgraphs[0]!.dimensions).toEqual(expandedDimensions);

    const collapsed = await layoutWorkflowGraph({
      ...expanded,
      subgraphs: expanded.subgraphs.map((subgraph) => ({ ...subgraph, collapsed: true })),
    });
    const collapsedNodeById = new Map(collapsed.nodes.map((node) => [node.id, node]));
    expect(collapsedNodeById.get('start')!.position.x).toBeLessThan(collapsed.subgraphs[0]!.position.x);
    expect(collapsed.subgraphs[0]!.position.x).toBeLessThan(collapsedNodeById.get('end')!.position.x);
    expect(collapsed.subgraphs[0]!.dimensions).toEqual(expandedDimensions);

    const reopened = await layoutWorkflowGraph({
      ...collapsed,
      subgraphs: collapsed.subgraphs.map((subgraph) => ({ ...subgraph, collapsed: false })),
    });
    expect(reopened.subgraphs[0]!.dimensions).toEqual(expandedDimensions);
    expect(reopened.nodes.find((node) => node.id === 'inside')!.parentId).toBe('cell');

    const recomputed = await layoutWorkflowGraph(reopened, { recomputeSubgraphDimensions: true });
    expect(recomputed.subgraphs[0]!.dimensions.width).toBeLessThan(expandedDimensions.width);
    expect(recomputed.subgraphs[0]!.dimensions.height).toBeLessThan(expandedDimensions.height);
  });

  it('adapts recursive compounds with stable ports and parent-relative geometry', async () => {
    const leaf = (id: string): CompoundLayoutNode<string> => ({
      id,
      value: id,
      dimensions: { width: CONTRACT_NODE_WIDTH, height: CONTRACT_NODE_HEIGHT },
    });
    const parent = (id: string, count: number): CompoundLayoutNode<string> => ({
      id,
      value: id,
      dimensions: { width: 340, height: 244 },
      children: Array.from({ length: count }, (_, index) => leaf(`${id}-leaf-${index}`)),
    });
    const depthThree: CompoundLayoutNode<string> = {
      id: 'depth-one',
      value: 'depth-one',
      dimensions: { width: 340, height: 244 },
      children: [{
        id: 'depth-two',
        value: 'depth-two',
        dimensions: { width: 340, height: 244 },
        children: [{
          id: 'depth-three',
          value: 'depth-three',
          dimensions: { width: 340, height: 244 },
          children: [leaf('deep-start'), leaf('deep-end')],
        }],
      }],
    };
    const root: CompoundLayoutNode<string> = {
      id: '__graphcontract_elk_root__',
      dimensions: { width: 0, height: 0 },
      children: [leaf('outside'), depthThree, parent('one', 1), parent('five', 5), parent('ten', 10)],
    };
    const edges = [
      { id: 'cross-boundary-enter', source: 'outside', target: 'deep-start' },
      { id: 'deep-flow', source: 'deep-start', target: 'deep-end' },
      ...['one', 'five', 'ten'].flatMap((id) => Array.from(
        { length: { one: 1, five: 5, ten: 10 }[id]! - 1 },
        (_, index) => ({ id: `${id}-${index}`, source: `${id}-leaf-${index}`, target: `${id}-leaf-${index + 1}` }),
      )),
    ];

    const elkInput = toElkCompoundGraph(root, edges);
    expect(elkInput.layoutOptions).toMatchObject({
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    });
    expect(elkInput.edges?.find((edge) => edge.id === 'cross-boundary-enter')).toMatchObject({
      sources: ['outside::graphcontract-east'],
      targets: ['deep-start::graphcontract-west'],
    });

    const geometry = await layoutCompoundGeometry(root, edges);
    expect(geometry.get('depth-two')?.parentId).toBe('depth-one');
    expect(geometry.get('depth-three')?.parentId).toBe('depth-two');
    expect(geometry.get('deep-start')?.parentId).toBe('depth-three');
    for (const [parentId, childId] of [
      ['depth-one', 'depth-two'],
      ['depth-two', 'depth-three'],
      ['depth-three', 'deep-start'],
    ] as const) {
      const container = geometry.get(parentId)!;
      const child = geometry.get(childId)!;
      expect(child.position.x).toBeGreaterThanOrEqual(36);
      expect(child.position.y).toBeGreaterThanOrEqual(56 + 36);
      expect(child.position.x + child.dimensions.width + 36).toBeLessThanOrEqual(container.dimensions.width);
      expect(child.position.y + child.dimensions.height + 36).toBeLessThanOrEqual(container.dimensions.height);
    }
    for (const [parentId, count] of [['one', 1], ['five', 5], ['ten', 10]] as const) {
      const container = geometry.get(parentId)!;
      for (let index = 0; index < count; index += 1) {
        const child = geometry.get(`${parentId}-leaf-${index}`)!;
        expect(child.parentId).toBe(parentId);
        expect(child.position.x).toBeGreaterThanOrEqual(36);
        expect(child.position.y).toBeGreaterThanOrEqual(56 + 36);
        expect(child.position.x + child.dimensions.width + 36).toBeLessThanOrEqual(container.dimensions.width);
        expect(child.position.y + child.dimensions.height + 36).toBeLessThanOrEqual(container.dimensions.height);
      }
    }
  });
});
