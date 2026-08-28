import { describe, expect, it } from 'vitest';

import { createWorkspaceService } from './workspace';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

describe('workspace application service', () => {
  it('keeps agent proposals non-destructive until human approval', () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Clarify the billing specialist.',
      expectedGraphUpdatedAt: initial.graph.updatedAt,
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    });

    expect(proposed.result?.ok).toBe(true);
    expect(proposed.state.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Billing Agent');

    const approved = service.approveProposal(proposed.state);
    expect(approved.result?.ok).toBe(true);
    expect(approved.state.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Billing Resolution Agent');
    expect(approved.state.proposal).toBeNull();
  });

  it('freezes a valid graph and enumerates its reachable paths', () => {
    const frozen = service.freezeGraph(service.createInitial());

    expect(frozen.result?.ok).toBe(true);
    expect(frozen.state.graph.status).toBe('frozen');
    expect(frozen.state.scenarios).toHaveLength(3);
  });

  it('locks accepted graph edits while a proposal awaits review', () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Clarify the billing specialist.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    });
    const edit = service.updateNode(proposed.state, 'diagnostic', { label: 'Changed manually' });

    expect(edit.changed).toBe(false);
    expect(edit.state.graph.nodes.find((node) => node.id === 'diagnostic')?.label).toBe('Diagnostic Action');
  });
});
