import { describe, expect, it } from 'vitest';

import { snapNodeToAlignment } from './canvas-geometry';

const node = (id: string, x: number, y: number) => ({
  id,
  position: { x, y },
  initialWidth: 100,
  initialHeight: 60,
});

describe('snapNodeToAlignment', () => {
  it('snaps matching centers on both axes', () => {
    const result = snapNodeToAlignment(
      node('moving', 204, 102),
      [node('moving', 204, 102), node('target', 200, 100)],
      6,
    );

    expect(result.position).toEqual({ x: 200, y: 100 });
    expect(result.guides).toEqual({ vertical: 250, horizontal: 130 });
  });

  it('snaps a node edge to another node edge', () => {
    const result = snapNodeToAlignment(
      node('moving', 296, 180),
      [node('moving', 296, 180), node('target', 200, 40)],
      6,
    );

    expect(result.position.x).toBe(300);
    expect(result.guides.vertical).toBe(300);
  });

  it('reports overlap after snapping', () => {
    const result = snapNodeToAlignment(
      node('moving', 96, 20),
      [node('moving', 96, 20), node('target', 100, 0)],
      6,
    );

    expect(result.collidingNodeIds).toEqual(['target']);
  });

  it('excludes hidden nodes from alignment and collision candidates', () => {
    const result = snapNodeToAlignment(
      node('moving', 96, 20),
      [
        node('moving', 96, 20),
        { ...node('hidden-child', 100, 0), hidden: true },
      ],
      6,
    );

    expect(result.position).toEqual({ x: 96, y: 20 });
    expect(result.guides).toEqual({});
    expect(result.collidingNodeIds).toEqual([]);
  });
});
