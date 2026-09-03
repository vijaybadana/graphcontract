import { describe, expect, it } from 'vitest';

import { sampleGraph } from '@/src/domain';
import {
  connectionReferences,
  filterConnectionReferences,
  filterPaletteItems,
  isPaletteItemSingletonDisabled,
  normalizePalettePreset,
  paletteItems,
  readDroppedPaletteKind,
} from './node-palette';

describe('node palette behavior', () => {
  it('keeps the eight visible inventory components searchable while accepting legacy Action drops', () => {
    expect(paletteItems).toHaveLength(8);
    expect(paletteItems).toEqual([
      expect.objectContaining({ kind: 'start', label: 'Start', group: 'Flow' }),
      expect.objectContaining({ kind: 'merge', label: 'Merge', group: 'Flow' }),
      expect.objectContaining({ kind: 'end', label: 'End', group: 'Flow' }),
      expect.objectContaining({ kind: 'step', label: 'Task', group: 'Execution' }),
      expect.objectContaining({ kind: 'agent', label: 'Agent', group: 'Execution' }),
      expect.objectContaining({ kind: 'tool', label: 'Tool', group: 'Execution' }),
      expect.objectContaining({ kind: 'humanReview', label: 'Human', group: 'Execution' }),
      expect.objectContaining({ kind: 'subgraph', label: 'Subgraph', group: 'Structure' }),
    ]);
    expect(filterPaletteItems('subgraph')).toEqual([
      expect.objectContaining({ kind: 'subgraph', group: 'Structure' }),
    ]);
    expect(filterPaletteItems('merge')).toEqual([
      expect.objectContaining({ kind: 'merge', group: 'Flow' }),
    ]);
    expect(
      readDroppedPaletteKind({
        dataTransfer: { getData: () => 'humanReview' },
      } as never),
    ).toBe('humanReview');
    expect(
      readDroppedPaletteKind({
        dataTransfer: { getData: () => 'human_input' },
      } as never),
    ).toBe('human_input');
    expect(normalizePalettePreset('human_input')).toBe('humanReview');
    expect(normalizePalettePreset('action')).toBe('action');
    expect(
      readDroppedPaletteKind({
        dataTransfer: { getData: () => 'action' },
      } as never),
    ).toBe('action');
  });

  it('keeps connection references separate from selectable component results', () => {
    expect(connectionReferences).toEqual([
      expect.objectContaining({ id: 'edge', label: 'Edge', explanation: 'A standard directed connection between two nodes.' }),
      expect.objectContaining({ id: 'conditional', label: 'Conditional', explanation: 'Follows this route when its condition matches.' }),
      expect.objectContaining({ id: 'command', label: 'Command', explanation: 'An agent-directed jump or handoff to another node.' }),
      expect.objectContaining({ id: 'fallback', label: 'Fallback', explanation: 'Used when the primary route cannot continue.' }),
      expect.objectContaining({ id: 'send', label: 'Send ×N', explanation: 'Dynamically fans work out to one template and rejoins at Merge.' }),
      expect.objectContaining({ id: 'loop', label: 'Loop ↺', explanation: 'Derived when a connection creates a cycle to an upstream node; an optional loop cap limits repetitions.', derived: true }),
    ]);
    expect(filterConnectionReferences('send')).toEqual([
      expect.objectContaining({ label: 'Send ×N', explanation: 'Dynamically fans work out to one template and rejoins at Merge.' }),
    ]);
    expect(filterPaletteItems('send')).toEqual([]);
  });

  it('keeps outer Start and End singleton-only until a subgraph needs member endpoints', () => {
    const start = paletteItems.find((item) => item.kind === 'start')!;
    const end = paletteItems.find((item) => item.kind === 'end')!;
    const legacyGraph = structuredClone(sampleGraph);
    const graphWithSubgraph = {
      ...structuredClone(sampleGraph),
      subgraphs: [
        {
          id: 'research-group',
          label: 'Research',
          position: { x: 280, y: 100 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
        },
      ],
    };

    expect(isPaletteItemSingletonDisabled(legacyGraph, start)).toBe(true);
    expect(isPaletteItemSingletonDisabled(legacyGraph, end)).toBe(true);
    expect(isPaletteItemSingletonDisabled(graphWithSubgraph, start)).toBe(false);
    expect(isPaletteItemSingletonDisabled(graphWithSubgraph, end)).toBe(false);
  });
});
