// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createProposal, researchIntakeRoutingGraph } from '@/src/domain';
import { useGraphStore } from '@/src/state/workspace-store';

import { ProposalPanel } from './proposal-panel';

function labelProposal() {
  const graph = structuredClone(researchIntakeRoutingGraph);
  const proposal = createProposal(graph, {
    rationale: 'Make the intake wording more explicit for reviewers.',
    operations: [
      {
        type: 'update_node',
        nodeId: 'clarify-request',
        patch: { label: 'Clarify Research Request' },
      },
    ],
  }).proposal!;
  // The overview must derive final truth from stable IDs and progressive
  // operations, even if the convenient stored diff is incomplete.
  proposal.diff.updatedNodeIds = [];
  return { graph, proposal };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  useGraphStore.setState({ proposal: null });
});

describe('ProposalPanel overview', () => {
  it('shows a read-only Before/Proposed comparison and applies changes only after human approval', () => {
    const { graph, proposal } = labelProposal();
    const acceptedBefore = structuredClone(graph);
    useGraphStore.setState({ graph, proposal });

    render(<ProposalPanel />);

    expect(screen.getByRole('heading', { name: 'Before / Proposed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Before' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Proposed' })).toBeTruthy();
    expect(screen.getByLabelText('Proposal diff summary').textContent).toContain(
      'Nodesupdated clarify-request (label)',
    );
    expect(screen.getByText(proposal.rationale)).toBeTruthy();
    expect(useGraphStore.getState().graph).toEqual(acceptedBefore);

    const approve = screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);

    expect(useGraphStore.getState().proposal).toBeNull();
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'clarify-request')?.label)
      .toBe('Clarify Research Request');
  }, 30_000);

  it('keeps a stale candidate reviewable but not approvable', () => {
    const { graph, proposal } = labelProposal();
    const changedAccepted = { ...graph, updatedAt: '2099-01-01T00:00:00.000Z' };
    useGraphStore.setState({ graph: changedAccepted, proposal });

    render(<ProposalPanel />);

    expect(screen.getByText('stale')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('accepted graph changed');
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(useGraphStore.getState().proposal).toBeNull();
    expect(useGraphStore.getState().graph).toEqual(changedAccepted);
  }, 30_000);
});
