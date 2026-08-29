import { describe, expect, it } from 'vitest';

import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import { positionsForCanvasCommit } from './use-canvas-node-interactions';

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
        data: { id: 'child', kind: 'agent', label: 'Supervisor', position: { x: 70, y: 38 } },
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
