import { describe, expect, it } from 'vitest';

import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import {
  positionsForCanvasCommit,
  reconcileProjectedNodes,
} from './use-canvas-node-interactions';

describe('positionsForCanvasCommit', () => {
  it('commits a dragged subgraph position without rewriting child relative coordinates', () => {
    const nodes = [
      {
        id: 'group',
        type: 'subgraph',
        position: { x: 420, y: 180 },
        data: {
          id: 'group',
          label: 'Research',
          position: { x: 420, y: 180 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
        },
      },
      {
        id: 'child',
        type: 'contractNode',
        parentId: 'group',
        position: { x: 70, y: 38 },
        data: { id: 'child', kind: 'step', executor: 'ai', label: 'Supervisor', position: { x: 70, y: 38 } },
      },
      {
        id: 'ordinary',
        type: 'contractNode',
        position: { x: 960, y: 220 },
        data: { id: 'ordinary', kind: 'end', label: 'End', position: { x: 960, y: 220 } },
      },
    ] as CanvasFlowNode[];

    expect(
      positionsForCanvasCommit(nodes, {
        group: { x: 420, y: 180 },
        child: { x: 70, y: 38 },
        ordinary: { x: 960, y: 220 },
      }),
    ).toEqual({
      group: { x: 420, y: 180 },
      ordinary: { x: 960, y: 220 },
    });
  });
});

describe('reconcileProjectedNodes', () => {
  it('moves rendered selection from a hidden child to its collapsed parent projection', () => {
    const expanded = [
      {
        id: 'group',
        type: 'subgraph',
        position: { x: 420, y: 180 },
        selected: false,
        data: {
          id: 'group',
          label: 'Research',
          position: { x: 420, y: 180 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
        },
      },
      {
        id: 'child',
        type: 'contractNode',
        parentId: 'group',
        position: { x: 70, y: 38 },
        selected: true,
        data: {
          id: 'child',
          kind: 'step',
          executor: 'ai',
          label: 'Supervisor',
          parentId: 'group',
          position: { x: 70, y: 38 },
        },
      },
    ] as CanvasFlowNode[];
    const collapsed = [
      {
        ...expanded[0],
        data: { ...expanded[0].data, collapsed: true },
      },
      {
        ...expanded[1],
        hidden: true,
      },
    ] as CanvasFlowNode[];

    const reconciled = reconcileProjectedNodes(expanded, collapsed, ['group']);

    expect(reconciled.map(({ id, selected }) => ({ id, selected }))).toEqual([
      { id: 'group', selected: true },
      { id: 'child', selected: false },
    ]);
  });
});
