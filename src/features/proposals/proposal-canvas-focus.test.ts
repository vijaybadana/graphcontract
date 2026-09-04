import { describe, expect, it } from 'vitest';

import { deriveProposalComparison } from '@/src/application/proposal-comparison';
import { createProposal, sampleGraph, type WorkflowGraph } from '@/src/domain';
import type { ProposalReviewEntry } from './proposal-overview';
import { proposalCanvasFocusFor, proposalInitialCanvasFitNodeIds } from './proposal-canvas-focus';

const entry = (
  section: string,
  id: string,
  value: unknown,
  state: 'added' | 'updated' | 'removed' = 'updated',
): ProposalReviewEntry => ({
  key: `${section}:${id}`,
  section,
  sectionLabel: section,
  changeIndex: 0,
  entry: {
    id,
    state,
    changedFields: ['*'],
    ...(state === 'removed' ? { before: value } : { after: value }),
  },
});

describe('proposalCanvasFocusFor', () => {
  it('focuses proposed and removed nodes by stable identity', () => {
    const graph = {
      nodes: [],
      edges: [
        { id: 'enter-review', source: 'start', target: 'review-step', mode: 'normal' },
        { id: 'leave-review', source: 'review-step', target: 'end', mode: 'normal' },
        { id: 'unrelated', source: 'other', target: 'archive', mode: 'normal' },
      ],
    } as unknown as WorkflowGraph;
    expect(proposalCanvasFocusFor(entry('nodes', 'review-step', { id: 'review-step' }), [graph])).toMatchObject({
      nodeIds: ['review-step'],
      edgeIds: [],
      contextNodeIds: ['start', 'end'],
      contextEdgeIds: ['enter-review', 'leave-review'],
      fitNodeIds: ['review-step'],
      cameraMode: 'detail',
    });
    expect(proposalCanvasFocusFor(entry('nodes', 'removed-step', { id: 'removed-step' }, 'removed'))).toMatchObject({
      nodeIds: ['removed-step'], fitNodeIds: ['removed-step'],
    });
  });

  it('focuses a native edge and both endpoints', () => {
    expect(proposalCanvasFocusFor(entry('native-edges', 'route', {
      id: 'route', source: 'source', target: 'target', mode: 'normal',
    }))).toMatchObject({
      nodeIds: ['source', 'target'], edgeIds: ['route'], fitNodeIds: ['source', 'target'],
      cameraMode: 'context',
    });
  });

  it('focuses relationship endpoints by projected identity', () => {
    expect(proposalCanvasFocusFor(entry('relationships', 'external-run', {
      id: 'external-run', kind: 'external-orchestration',
      source: { kind: 'node', nodeId: 'agent' },
      target: { kind: 'external', externalId: 'runner/api', label: 'Runner' },
      provenance: { representation: 'external-orchestration' },
    }))).toMatchObject({
      nodeIds: ['agent', 'external-system:runner%2Fapi'], relationshipId: 'external-run',
    });
  });

  it('frames added proposal elements instead of fitting the full candidate', () => {
    const proposal = createProposal(sampleGraph, {
      rationale: 'Add a reviewed downstream check and rename an existing node.',
      operations: [
        { type: 'update_node', nodeId: 'classifier', patch: { label: 'Updated classifier' } },
        {
          type: 'add_node',
          node: {
            id: 'reviewed-check',
            kind: 'step',
            executor: 'deterministic',
            label: 'Reviewed check',
            position: { x: 1180, y: 320 },
          },
        },
      ],
    }).proposal!;
    const review = deriveProposalComparison(sampleGraph, proposal);

    expect(proposalInitialCanvasFitNodeIds(review)).toEqual(['reviewed-check']);
  });
});
