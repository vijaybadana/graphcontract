import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { readableFitMinZoom, readableFitNodeIds } from './use-coalesced-fit-view';

const node = (value: Partial<Node> & Pick<Node, 'id'>): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  ...value,
});

describe('readableFitNodeIds', () => {
  it('keeps visible authored nodes and excludes hidden projection artifacts', () => {
    expect(readableFitNodeIds([
      node({ id: 'start' }),
      node({ id: 'hidden', hidden: true }),
      node({ id: 'end' }),
    ])).toEqual(['start', 'end']);
  });

  it('fits expanded subgraph members instead of the oversized background container', () => {
    expect(readableFitNodeIds([
      node({ id: 'group', type: 'subgraph', data: { collapsed: false } }),
      node({ id: 'child-a', parentId: 'group' }),
      node({ id: 'child-b', parentId: 'group' }),
      node({ id: 'outside' }),
    ])).toEqual(['child-a', 'child-b', 'outside']);
  });

  it('keeps collapsed and empty subgraphs as meaningful fit targets', () => {
    expect(readableFitNodeIds([
      node({ id: 'collapsed', type: 'subgraph', data: { collapsed: true } }),
      node({ id: 'empty', type: 'subgraph', data: { collapsed: false } }),
    ])).toEqual(['collapsed', 'empty']);
  });
});

describe('readableFitMinZoom', () => {
  it('preserves the configured floor for ordinary graphs', () => {
    expect(readableFitMinZoom([node({ id: 'step', type: 'contractNode', width: 220 })], 0.48)).toBe(0.48);
  });

  it('allows a large declared worker template to fit without changing compact floors', () => {
    const nodes = [node({
      id: 'dynamic-worker-group:send',
      type: 'dynamicWorkerGroup',
      width: 1160,
      initialWidth: 1160,
    })];
    expect(readableFitMinZoom(nodes, 0.48)).toBe(0.32);
    expect(readableFitMinZoom(nodes, 0.28)).toBe(0.28);
  });
});
