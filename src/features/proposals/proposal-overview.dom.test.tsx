// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    render(<ProposalPanel proposal={proposal} review={review} reviewRequest={null} onApprove={onApprove} onRequestChanges={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Before / Proposed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Before' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Proposed' })).toBeTruthy();
    expect(screen.getByLabelText('Proposal diff summary').textContent).toContain(
      'Nodesupdated clarify-request (label)',
    );
    expect(screen.getByLabelText('Changed values for clarify-request').textContent).toContain(
      'Before: Clarify Request',
    );
    expect(screen.getByLabelText('Changed values for clarify-request').textContent).toContain(
      'Proposed: Clarify Research Request',
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
        reviewRequest={null}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
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

    render(<ProposalPanel proposal={proposal} review={deriveProposalComparison(changedAccepted, proposal)} reviewRequest={null} onApprove={vi.fn()} onRequestChanges={vi.fn()} onReject={onReject} />);

    expect(screen.getByText('stale')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('accepted graph changed');
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(onReject).toHaveBeenCalledOnce();
    expect(changedAccepted.updatedAt).toBe('2099-01-01T00:00:00.000Z');
  }, 30_000);

  it('collects meaningful human revision feedback in an accessible dialog and restores focus', async () => {
    const { graph, proposal } = labelProposal();
    const acceptedBefore = structuredClone(graph);
    const onRequestChanges = vi.fn(() => ({
      ok: true as const,
      reviewRequest: {
        status: 'changes_requested' as const,
        feedback: 'Keep the original label and add an escalation route.',
        proposalId: proposal.id,
        proposalCreatedAt: proposal.createdAt,
        reviewedGraphId: graph.id,
        reviewedGraphUpdatedAt: graph.updatedAt,
        reviewedAt: '2026-09-01T10:00:00.000Z',
      },
    }));
    render(
      <ProposalPanel
        proposal={proposal}
        review={deriveProposalComparison(graph, proposal)}
        reviewRequest={null}
        onApprove={vi.fn()}
        onRequestChanges={onRequestChanges}
        onReject={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Request changes' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Request proposal changes' });
    const feedback = screen.getByRole('textbox', { name: 'Requested changes' });
    const submit = screen.getByRole('button', { name: 'Submit request' }) as HTMLButtonElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(feedback));
    expect(submit.disabled).toBe(true);
    fireEvent.change(feedback, { target: { value: '  ' } });
    expect(submit.disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(trigger);
    const reopenedFeedback = screen.getByRole('textbox', { name: 'Requested changes' });
    fireEvent.change(reopenedFeedback, {
      target: { value: 'Keep the original label and add an escalation route.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(onRequestChanges).toHaveBeenCalledWith(
      'Keep the original label and add an escalation route.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(graph).toEqual(acceptedBefore);
  });

  it('renders persisted human feedback as plain text while waiting for revision', () => {
    const feedback = '<img src=x onerror=alert(1)> Keep the original node label.';
    render(
      <ProposalPanel
        proposal={null}
        review={null}
        reviewRequest={{
          status: 'changes_requested',
          feedback,
          proposalId: 'proposal-1',
          proposalCreatedAt: '2026-09-01T09:00:00.000Z',
          reviewedGraphId: 'graph-1',
          reviewedGraphUpdatedAt: '2026-09-01T08:00:00.000Z',
          reviewedAt: '2026-09-01T10:00:00.000Z',
        }}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText(feedback)).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });
});
