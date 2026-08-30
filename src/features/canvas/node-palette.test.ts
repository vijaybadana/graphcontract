import { describe, expect, it } from 'vitest';

import { createProposal, sampleGraph } from '@/src/domain';
import {
  filterPaletteItems,
  getContractHealthLabel,
  isPaletteItemSingletonDisabled,
  normalizePalettePreset,
  paletteItems,
  readDroppedPaletteKind,
} from './node-palette';

describe('contract health presentation', () => {
  it('prioritizes pending proposal review over freeze readiness', () => {
    const graph = structuredClone(sampleGraph);
    const proposal = createProposal(graph, {
      rationale: 'Clarify the billing label.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Review Agent' } },
      ],
    }).proposal!;

    expect(getContractHealthLabel(graph, proposal, 0)).toBe(
      'Valid — proposal awaiting review.',
    );
  });

  it('keeps Subgraph and Merge in the searchable inventory and accepts presets on canvas drop', () => {
    expect(paletteItems).toHaveLength(9);
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
