import { describe, expect, it } from 'vitest';

import {
  createProposal,
  researchIntakeRoutingGraph,
  type WorkflowGraph,
} from '@/src/domain';
import { deriveProposalComparison } from './proposal-comparison';

function requireComparableReview(review: ReturnType<typeof deriveProposalComparison>) {
  expect(review.kind).toBe('comparable');
  if (review.kind !== 'comparable') throw new Error('Expected a comparable proposal review.');
  return review;
}

describe('deriveProposalComparison', () => {
  it('derives deterministic final truth by ID instead of trusting proposal.diff', () => {
    const base = structuredClone(researchIntakeRoutingGraph);
    const before = structuredClone(base);
    const proposal = createProposal(base, {
      rationale: 'Add and then refine a candidate relationship and step.',
      operations: [
        {
          type: 'add_node',
          node: {
            id: 'candidate-step', kind: 'step', label: 'Candidate', executor: 'ai',
            position: { x: 640, y: 120 }, readiness: { state: 'ready' },
          },
        },
        { type: 'update_node', nodeId: 'candidate-step', patch: { label: 'Refined candidate' } },
        {
          type: 'add_subgraph',
          subgraph: {
            id: 'candidate-zone',
            label: 'Candidate zone',
            position: { x: 600, y: 80 },
            dimensions: { width: 320, height: 220 },
            collapsed: false,
          },
        },
        { type: 'remove_edge', edgeId: 'supervisor-human-review' },
        {
          type: 'add_relationship',
          relationship: {
            id: 'candidate-thread', kind: 'spawned-thread', label: 'Review thread',
            source: { kind: 'node', nodeId: 'candidate-step' },
            target: { kind: 'external', externalId: 'review', label: 'Review system' },
            provenance: { representation: 'external-orchestration' },
          },
        },
        { type: 'update_graph_capabilities', patch: { store: { available: true, namespace: 'reviews' } } },
      ],
    }).proposal!;
    proposal.diff = { ...proposal.diff, addedNodeIds: [], removedEdgeIds: [] };

    const comparison = requireComparableReview(deriveProposalComparison(base, proposal));

    expect(comparison.nodes['candidate-step']).toMatchObject({
      state: 'added', after: { label: 'Refined candidate' },
    });
    expect(comparison.subgraphs['candidate-zone']).toMatchObject({ state: 'added' });
    expect(comparison.nativeEdges['supervisor-human-review']).toMatchObject({ state: 'removed' });
    expect(comparison.relationships['candidate-thread']).toMatchObject({ state: 'added' });
    expect(comparison.capabilities['graph.store']).toMatchObject({
      state: 'updated', changedFields: ['available', 'namespace'],
      before: { available: false },
      after: { available: true, namespace: 'reviews' },
    });
    expect(comparison.nodes).toEqual(Object.fromEntries(Object.entries(comparison.nodes).sort(([a], [b]) => a.localeCompare(b))));
    expect(base).toEqual(before);
  });

  it('does not misclassify normalized arrays of records as changed', () => {
    const base = structuredClone(researchIntakeRoutingGraph);
    base.capabilities.state = {
      enabled: true,
      schema: { fields: ['request'] },
      reducers: [{ key: 'evidence', summary: 'Append unique evidence' }],
    };
    const proposal = createProposal(base, {
      rationale: 'Clarify the accepted label.',
      operations: [{ type: 'update_node', nodeId: 'clarify-request', patch: { label: 'Clarify Research Request' } }],
    }).proposal!;

    const comparison = requireComparableReview(deriveProposalComparison(base, proposal));

    expect(comparison.capabilities['graph.state']).toMatchObject({ state: 'unchanged', changedFields: [] });
    expect(comparison.nodes['clarify-request']).toMatchObject({
      state: 'updated',
      changedFields: ['label'],
    });
    expect(comparison.approvable).toBe(true);
    expect(comparison.effectiveStatus).toBe('pending');
  });

  it('reports operation and invalid truth without treating the candidate as approvable', () => {
    const base = structuredClone(researchIntakeRoutingGraph) as WorkflowGraph;
    const proposal = createProposal(base, {
      rationale: 'Reference a missing node.',
      operations: [{ type: 'update_node', nodeId: 'missing', patch: { label: 'Nope' } }],
    }).proposal!;

    const invalidComparison = requireComparableReview(deriveProposalComparison(base, proposal));

    expect(invalidComparison.operationErrors.map((entry) => entry.code)).toContain('OPERATION_NOT_FOUND');
    expect(invalidComparison.invalid).toBe(true);
    expect(invalidComparison.effectiveStatus).toBe('invalid');
    expect(invalidComparison.approvable).toBe(false);
  });

  it.each([
    [
      'graph ID',
      { id: 'replacement-graph' },
      'base_graph_id_mismatch',
    ],
    [
      'graph timestamp',
      { updatedAt: '2099-01-01T00:00:00.000Z' },
      'base_graph_updated_at_mismatch',
    ],
  ] as const)('returns accepted-only review state for a stale %s', (_label, change, reason) => {
    const base = structuredClone(researchIntakeRoutingGraph) as WorkflowGraph;
    const proposal = createProposal(base, {
      rationale: 'This candidate must never be replayed against another accepted graph.',
      operations: [{
        type: 'update_node',
        nodeId: 'clarify-request',
        patch: { label: 'Synthetic stale candidate' },
      }],
    }).proposal!;
    const accepted = { ...base, ...change };

    const review = deriveProposalComparison(accepted, proposal);

    expect(review).toMatchObject({
      kind: 'stale',
      accepted: { id: accepted.id, updatedAt: accepted.updatedAt },
      reason,
    });
    expect(review).not.toHaveProperty('candidate');
    expect(review).not.toHaveProperty('base');
    expect(review).not.toHaveProperty('nodes');
    expect(JSON.stringify(review)).not.toContain('Synthetic stale candidate');
    if (review.kind !== 'stale') throw new Error('Expected stale accepted-only review state.');
    expect(review.accepted.nodes.find((node) => node.id === 'clarify-request')?.label)
      .toBe('Clarify Request');
    expect(review.accepted).not.toBe(accepted);
  });
});
