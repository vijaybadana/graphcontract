import { describe, expect, it } from 'vitest';

import { createProposal, sampleGraph } from '@/src/domain';
import { getContractHealthLabel } from './node-palette';

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
});
