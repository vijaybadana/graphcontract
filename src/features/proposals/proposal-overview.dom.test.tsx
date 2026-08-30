// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProposal, researchIntakeRoutingGraph } from '@/src/domain';
import { deriveProposalComparison } from '@/src/application/proposal-comparison';

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
});

describe('ProposalPanel overview', () => {
  it('shows a read-only Before/Proposed comparison and applies changes only after human approval', () => {
    const { graph, proposal } = labelProposal();
    const acceptedBefore = structuredClone(graph);
    const onApprove = vi.fn();
    const review = deriveProposalComparison(graph, proposal);
    proposal.operations = [{
      type: 'update_node',
      nodeId: 'clarify-request',
      patch: { label: 'Wrong raw replay label' },
    }];

    render(<ProposalPanel proposal={proposal} review={review} onApprove={onApprove} onReject={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Before / Proposed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Before' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Proposed' })).toBeTruthy();
    expect(screen.getByLabelText('Proposal diff summary').textContent).toContain(
      'Nodesupdated clarify-request (label)',
    );
    expect(screen.getByText(proposal.rationale)).toBeTruthy();
    expect(screen.queryByText('Wrong raw replay label')).toBeNull();
    expect(screen.getByText('Clarify Research Request')).toBeTruthy();
    expect(graph).toEqual(acceptedBefore);

    const approve = screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);

    expect(onApprove).toHaveBeenCalledOnce();
    expect(graph).toEqual(acceptedBefore);
  }, 30_000);

  it('reports net-zero progressive operations as no effective graph changes', () => {
    const graph = structuredClone(researchIntakeRoutingGraph);
    const acceptedLabel = graph.nodes.find((node) => node.id === 'clarify-request')!.label;
    const proposal = createProposal(graph, {
      rationale: 'Restore the accepted wording after a temporary change.',
      operations: [
        { type: 'update_node', nodeId: 'clarify-request', patch: { label: 'Temporary wording' } },
        { type: 'update_node', nodeId: 'clarify-request', patch: { label: acceptedLabel } },
      ],
    }).proposal!;
    proposal.diff.updatedNodeIds = ['clarify-request'];

    render(
      <ProposalPanel
        proposal={proposal}
        review={deriveProposalComparison(graph, proposal)}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('No effective graph changes')).toBeTruthy();
    expect(screen.getByText('0 changed')).toBeTruthy();
    expect(screen.queryByText('Temporary wording')).toBeNull();
  }, 30_000);

  it('keeps a stale candidate reviewable but not approvable', () => {
    const { graph, proposal } = labelProposal();
    const changedAccepted = { ...graph, updatedAt: '2099-01-01T00:00:00.000Z' };
    const onReject = vi.fn();

    render(<ProposalPanel proposal={proposal} review={deriveProposalComparison(changedAccepted, proposal)} onApprove={vi.fn()} onReject={onReject} />);

    expect(screen.getByText('stale')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('accepted graph changed');
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(onReject).toHaveBeenCalledOnce();
    expect(changedAccepted.updatedAt).toBe('2099-01-01T00:00:00.000Z');
  }, 30_000);
});
