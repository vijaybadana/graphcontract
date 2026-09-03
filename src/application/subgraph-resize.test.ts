import { describe, expect, it } from 'vitest';

import { subgraphResizeLimits, constrainSubgraphDimensions } from './subgraph-resize';
import { createDefaultGraphCapabilities, type WorkflowGraph } from '@/src/domain';

const graphWithNestedSubgraph = (): WorkflowGraph => ({
  id: 'resize-contract',
  name: 'Resize contract',
  status: 'draft',
  schemaVersion: '6',
  updatedAt: '2026-09-04T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  relationships: [],
  nodes: [
    {
      id: 'nested-child',
      kind: 'step',
      executor: 'deterministic',
      label: 'Nested child',
      position: { x: 40, y: 80 },
      parentId: 'nested',
    },
    {
      id: 'right-sibling',
      kind: 'step',
      executor: 'deterministic',
      label: 'Right sibling',
      position: { x: 620, y: 220 },
      parentId: 'outer',
    },
    {
      id: 'bottom-sibling',
      kind: 'step',
      executor: 'deterministic',
      label: 'Bottom sibling',
      position: { x: 140, y: 520 },
      parentId: 'outer',
    },
  ],
  subgraphs: [
    {
      id: 'outer',
      label: 'Outer',
      position: { x: 20, y: 20 },
      dimensions: { width: 1_000, height: 800 },
      collapsed: false,
    },
    {
      id: 'nested',
      label: 'Nested',
      position: { x: 100, y: 200 },
      dimensions: { width: 400, height: 260 },
      collapsed: false,
      parentId: 'outer',
    },
  ],
  edges: [],
});

describe('subgraph resize constraints', () => {
  it('keeps direct children inside and stops bottom-right expansion before siblings', () => {
    const limits = subgraphResizeLimits(graphWithNestedSubgraph(), 'nested');

    expect(limits).toMatchObject({
      minWidth: 340,
      minHeight: 250,
      maxWidth: 864,
      maxHeight: 564,
    });
    expect(constrainSubgraphDimensions({ width: 800, height: 500 }, limits!)).toEqual({
      width: 508,
      height: 308,
    });
  });

  it('permits shrinking to the child-content floor and uses parent bounds without siblings', () => {
    const graph = graphWithNestedSubgraph();
    graph.nodes = graph.nodes.filter((node) => node.id === 'nested-child');
    const limits = subgraphResizeLimits(graph, 'nested');

    expect(constrainSubgraphDimensions({ width: 200, height: 200 }, limits!)).toEqual({
      width: 340,
      height: 250,
    });
    expect(constrainSubgraphDimensions({ width: 2_000, height: 2_000 }, limits!)).toEqual({
      width: 864,
      height: 564,
    });
  });
});
