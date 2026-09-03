import { describe, expect, it } from 'vitest';

import { researchSupervisorGraph, validateGraph, workflowGraphSchema } from '@/src/domain';
import { graphLibraryEntries } from '@/src/application/graph-library';
import {
  buildGraphContractDownload,
  buildGraphScenariosDownload,
} from '@/src/adapters/exports/downloads';
import { createWorkspaceService } from './workspace';
import { dynamicWorkerGroupLayout } from './dynamic-worker-layout';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

describe('workspace application service', () => {
  it('creates every work preset as a canonical Step and preserves its independent fields on duplication', () => {
    let id = 0;
    const presetService = createWorkspaceService({
      now: () => '2026-08-30T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-${++id}`,
    });
    let state = presetService.createInitial();
    const expectedExecutors = {
      step: 'deterministic',
      agent: 'ai',
      action: 'deterministic',
      tool: 'tool',
      humanReview: 'human',
    } as const;

    for (const [preset, executor] of Object.entries(expectedExecutors)) {
      const added = presetService.addNode(
        state,
        preset as keyof typeof expectedExecutors,
        { x: 100 + id * 20, y: 120 },
      );
      expect(added.result?.nodeId).toBeTruthy();
      const node = added.state.graph.nodes.find((candidate) => candidate.id === added.result?.nodeId);
      expect(node).toMatchObject({ kind: 'step', executor });
      state = added.state;
    }

    const originalId = state.graph.nodes.at(-1)!.id;
    const updated = presetService.updateNode(state, originalId, {
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'after',
        response: {
          type: 'approval',
          allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'end' }],
        },
      },
      sensitive: {
        target: 'Review record',
        authorization: 'Review owner',
        approvalRequired: false,
        idempotency: 'Review request ID',
      },
      modifiers: { guardrail: true, storeRead: true, retryFallback: true },
    });
    const duplicated = presetService.duplicateNodes(updated.state, [originalId]);
    const copy = duplicated.state.graph.nodes.find((node) => node.id === duplicated.result?.nodeIds[0]);

    expect(copy).toMatchObject({
      kind: 'step',
      executor: 'human',
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'after',
        response: {
          type: 'approval',
          allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'end' }],
        },
      },
      sensitive: { target: 'Review record', approvalRequired: false },
      modifiers: { guardrail: true, storeRead: true, retryFallback: true },
    });
    expect(
      workflowGraphSchema.parse(JSON.parse(buildGraphContractDownload(duplicated.state.graph).content)).nodes.find(
        (node) => node.id === copy?.id,
      ),
    ).toMatchObject({
      kind: 'step',
      executor: 'human',
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'after',
        response: {
          type: 'approval',
          allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'end' }],
        },
      },
      sensitive: { target: 'Review record', approvalRequired: false },
      modifiers: { guardrail: true, storeRead: true, retryFallback: true },
    });
  });

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

  it('retains the reviewed candidate and feedback until a current valid replacement becomes pending', () => {
    const initial = service.createInitial();
    const acceptedBefore = structuredClone(initial.graph);
    const proposed = service.submitProposal(initial, {
      rationale: 'Clarify the billing specialist.',
      expectedGraphUpdatedAt: initial.graph.updatedAt,
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    });
    const empty = service.requestProposalChanges(proposed.state, '  ');

    expect(empty.changed).toBe(false);
    expect(empty.result).toMatchObject({ ok: false, error: { code: 'REVIEW_FEEDBACK_REQUIRED' } });
    expect(empty.state.proposal?.status).toBe('pending');

    const requested = service.requestProposalChanges(
      proposed.state,
      '  Keep the original label and document the escalation route instead.  ',
    );
    expect(requested.result).toMatchObject({
      ok: true,
      reviewRequest: {
        status: 'changes_requested',
        feedback: 'Keep the original label and document the escalation route instead.',
        proposalId: proposed.state.proposal?.id,
        reviewedGraphId: initial.graph.id,
        reviewedGraphUpdatedAt: initial.graph.updatedAt,
      },
    });
    expect(requested.state.graph).toEqual(acceptedBefore);
    expect(requested.state.proposal).toEqual(proposed.state.proposal);
    expect(requested.state.proposal).toMatchObject({
      id: proposed.state.proposal?.id,
      operations: proposed.state.proposal?.operations,
      diff: proposed.state.proposal?.diff,
    });
    expect(service.approveProposal(requested.state)).toMatchObject({
      changed: false,
      state: { proposal: { id: proposed.state.proposal?.id } },
      result: { ok: false, error: { code: 'PROPOSAL_CHANGES_REQUESTED' } },
    });
    expect(service.rejectProposal(requested.state)).toMatchObject({
      changed: false,
      state: { proposal: { id: proposed.state.proposal?.id } },
    });
    expect(service.requestProposalChanges(requested.state, 'Ask for something else.')).toMatchObject({
      changed: false,
      result: { ok: false, error: { code: 'PROPOSAL_CHANGES_ALREADY_REQUESTED' } },
    });

    const stale = service.submitProposal(requested.state, {
      rationale: 'Use a stale read.',
      expectedGraphUpdatedAt: '2020-01-01T00:00:00.000Z',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { description: 'Escalates complex cases.' } }],
    });
    expect(stale.result).toMatchObject({ ok: false, error: { code: 'PROPOSAL_STALE' } });
    expect(stale.state.proposal).toEqual(proposed.state.proposal);
    expect(stale.state.reviewRequest).toEqual(requested.state.reviewRequest);

    const invalid = service.submitProposal(requested.state, {
      rationale: 'Reference a missing node.',
      expectedGraphUpdatedAt: initial.graph.updatedAt,
      operations: [{ type: 'update_node', nodeId: 'missing', patch: { label: 'Missing' } }],
    });
    expect(invalid.result).toMatchObject({ ok: false, error: { code: 'PROPOSAL_INVALID' } });
    expect(invalid.state.proposal).toEqual(proposed.state.proposal);
    expect(invalid.state.reviewRequest).toEqual(requested.state.reviewRequest);

    const acceptedRevisionChanged = service.submitProposal(
      {
        ...invalid.state,
        graph: { ...invalid.state.graph, updatedAt: '2026-09-02T12:00:00.000Z' },
      },
      {
        rationale: 'Attempt to replace against a different accepted revision.',
        expectedGraphUpdatedAt: '2026-09-02T12:00:00.000Z',
        operations: [{ type: 'update_node', nodeId: 'billing', patch: { description: 'Escalates complex cases.' } }],
      },
    );
    expect(acceptedRevisionChanged.result).toMatchObject({ ok: false, error: { code: 'PROPOSAL_STALE' } });
    expect(acceptedRevisionChanged.state.proposal).toEqual(proposed.state.proposal);
    expect(acceptedRevisionChanged.state.reviewRequest).toEqual(requested.state.reviewRequest);

    const revised = service.submitProposal(invalid.state, {
      rationale: 'Document the escalation route without changing its identity.',
      expectedGraphUpdatedAt: initial.graph.updatedAt,
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { description: 'Escalates complex cases.' } }],
    });
    expect(revised.result).toMatchObject({ ok: true, proposal: { status: 'pending' } });
    expect(revised.state.reviewRequest).toBeNull();
    expect(revised.state.graph).toEqual(acceptedBefore);
  });

  it('keeps rejection terminal and does not manufacture revision feedback', () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Clarify the billing specialist.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    });

    const rejected = service.rejectProposal(proposed.state);

    expect(rejected.state.graph).toEqual(initial.graph);
    expect(rejected.state.proposal).toBeNull();
    expect(rejected.state.reviewRequest ?? null).toBeNull();
  });

  it('keeps the accepted graph immutable for an invalid multi-operation proposal', () => {
    const initial = service.createInitial();
    const before = structuredClone(initial.graph);
    const proposed = service.submitProposal(initial, {
      rationale: 'Rename billing while adding an invalid return route.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } },
        {
          type: 'add_edge',
          edge: {
            id: 'billing-missing-return',
            source: 'billing',
            target: 'missing-node',
            mode: 'normal',
          },
        },
      ],
    });

    expect(proposed.result?.proposal.status).toBe('invalid');
    expect(proposed.state.graph).toEqual(before);

    const approval = service.approveProposal(proposed.state);
    expect(approval.result).toEqual({
      ok: false,
      error: {
        code: 'PROPOSAL_INVALID',
        message: 'There is no valid pending proposal to approve.',
      },
    });
    expect(approval.state.graph).toEqual(before);
  });

  it('keeps self and duplicate connection proposals invalid, unapprovable, and out of accepted state', () => {
    const initial = service.createInitial();
    const before = structuredClone(initial.graph);
    const proposed = service.submitProposal(initial, {
      rationale: 'Add two invalid routes for review.',
      operations: [
        {
          type: 'add_edge',
          edge: {
            id: 'classifier-self',
            source: 'classifier',
            target: 'classifier',
            mode: 'conditional',
            label: 'retry',
          },
        },
        {
          type: 'add_edge',
          edge: {
            id: 'start-classifier-duplicate',
            source: 'start',
            target: 'classifier',
            mode: 'normal',
          },
        },
      ],
    });

    expect(proposed.result?.proposal).toMatchObject({ status: 'invalid' });
    expect(proposed.result?.proposal.validationErrors?.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['SELF_CONNECTION', 'DUPLICATE_CONNECTION']),
    );
    expect(proposed.state.graph).toEqual(before);

    const approval = service.approveProposal(proposed.state);
    expect(approval.result?.ok).toBe(false);
    expect(approval.state.graph).toEqual(before);
  });

  it('approves a canonical source-to-target return edge as derived loop topology', () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Route billing back to classification for a corrected request.',
      expectedGraphUpdatedAt: initial.graph.updatedAt,
      operations: [
        { type: 'remove_edge', edgeId: 'billing-refund' },
        { type: 'remove_edge', edgeId: 'diagnostic-end' },
        {
          type: 'add_edge',
          edge: {
            id: 'billing-classifier-return',
            source: 'billing',
            target: 'classifier',
            mode: 'normal',
          },
        },
        {
          type: 'add_edge',
          edge: {
            id: 'diagnostic-refund',
            source: 'diagnostic',
            target: 'refund',
            mode: 'normal',
          },
        },
      ],
    });

    expect(proposed.result?.proposal.status).toBe('pending');
    expect(proposed.state.graph.edges.some((edge) => edge.id === 'billing-classifier-return')).toBe(false);

    const approved = service.approveProposal(proposed.state);
    expect(approved.result?.ok).toBe(true);
    expect(approved.state.graph.edges).toContainEqual(expect.objectContaining({
      id: 'billing-classifier-return',
      source: 'billing',
      target: 'classifier',
      mode: 'normal',
      provenance: { representation: 'declared' },
    }));
  });

  it('approves a valid subgraph proposal through the human path and reflows its relative geometry', async () => {
    let timestamp = '2026-08-28T12:00:00.000Z';
    const timestampedService = createWorkspaceService({
      now: () => timestamp,
      makeId: (prefix) => `${prefix}-generated`,
    });
    const initial = timestampedService.loadResearchSupervisorDemo(timestampedService.createInitial());
    const proposed = timestampedService.submitProposal(initial.state, {
      rationale: 'Move the research container without changing its internal layout.',
      operations: [
        {
          type: 'update_subgraph',
          subgraphId: 'research-supervisor',
          patch: { position: { x: 340, y: 180 } },
        },
      ],
    });

    expect(proposed.result?.proposal.status).toBe('pending');
    expect(proposed.state.graph.updatedAt).toBe('2026-08-28T12:00:00.000Z');
    timestamp = '2026-08-28T12:01:00.000Z';
    const approved = timestampedService.approveProposal(proposed.state);

    expect(approved.result?.ok).toBe(true);
    expect(approved.state.graph.updatedAt).toBe('2026-08-28T12:01:00.000Z');
    expect(approved.layoutApplied).toBe(true);
    const laidOut = await approved.layoutPromise!;
    expect(laidOut.subgraphs[0]?.position).not.toEqual({ x: 340, y: 180 });
    expect(laidOut.nodes.find((node) => node.id === 'research-supervisor-agent')).toMatchObject({
      parentId: 'research-supervisor',
      position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    });
  });

  it('rejects a subgraph proposal without changing accepted timestamps or graph data', () => {
    const initial = service.loadResearchSupervisorDemo(service.createInitial());
    const before = structuredClone(initial.state.graph);
    const proposed = service.submitProposal(initial.state, {
      rationale: 'Rename the research container.',
      operations: [
        {
          type: 'update_subgraph',
          subgraphId: 'research-supervisor',
          patch: { label: 'Research review' },
        },
      ],
    });
    const rejected = service.rejectProposal(proposed.state);

    expect(rejected.changed).toBe(true);
    expect(rejected.state.proposal).toBeNull();
    expect(rejected.state.graph).toEqual(before);
    expect(rejected.state.graph.updatedAt).toBe(before.updatedAt);
  });

  it('keeps expectedGraphUpdatedAt optional and rejects either stale identity field identically', () => {
    const initial = service.createInitial();
    const compatible = service.submitProposal(initial, {
      rationale: 'Existing clients may omit the timestamp.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } }],
    });
    const mismatched = service.submitProposal(initial, {
      rationale: 'This read is stale.',
      expectedGraphUpdatedAt: '2026-01-01T00:00:00.000Z',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } }],
    });
    const staleGraphs = [
      { ...compatible.state.graph, id: 'replacement-graph' },
      { ...compatible.state.graph, updatedAt: '2026-08-29T00:00:00.000Z' },
    ];
    const staleApprovals = staleGraphs.map((graph) => service.approveProposal({
      ...compatible.state,
      graph,
    }));
    const staleError = {
      ok: false as const,
      error: {
        code: 'PROPOSAL_STALE',
        message: 'The graph changed after this proposal was created.',
      },
    };

    expect(compatible.result?.ok).toBe(true);
    expect(mismatched.result).toEqual({
      ok: false,
      error: {
        code: 'PROPOSAL_STALE',
        message: 'The accepted graph changed. Read it again before proposing changes.',
      },
    });
    expect(staleApprovals[0].result).toEqual(staleApprovals[1].result);
    staleApprovals.forEach((stale, index) => {
      expect(stale.result).toEqual(staleError);
      expect(stale.changed).toBe(true);
      expect(stale.notice).toBe('Proposal is stale. Ask the agent to read the graph again.');
      expect(stale.state.graph).toEqual(staleGraphs[index]);
      expect(stale.state.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Billing Agent');
      expect(stale.state.proposal?.status).toBe('stale');
    });
  });

  it('freezes a valid graph and enumerates its reachable paths', () => {
    const frozen = service.freezeGraph(service.createInitial());

    expect(frozen.result?.ok).toBe(true);
    expect(frozen.state.graph.status).toBe('frozen');
    expect(frozen.state.scenarios).toHaveLength(3);
  });

  it('keeps the accepted graph draft when scenario complexity exceeds the freeze budget', () => {
    const boundedService = createWorkspaceService({
      now: () => '2026-08-28T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-bounded`,
      scenarioBudget: { maxScenarios: 2, maxExpansions: 100 },
    });
    const initial = boundedService.createInitial();
    const frozen = boundedService.freezeGraph(initial);

    expect(frozen).toMatchObject({
      changed: false,
      state: { graph: { status: 'draft' }, scenarios: [] },
      notice: expect.stringContaining('Simplify conditional or human-outcome branching'),
      result: {
        ok: false,
        issues: [expect.objectContaining({
          code: 'SCENARIO_COUNT_BUDGET_EXCEEDED',
          path: 'scenarios',
        })],
      },
    });
    expect(frozen.state).toEqual(initial);
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

  it('rejects Step-only direct updates on Start and End without changing accepted state', () => {
    const initial = service.createInitial();
    const rejected = service.updateNode(initial, 'start', {
      executor: 'ai',
      hitl: {
        enabled: true,
        timing: 'before',
        response: {
          type: 'approval',
          allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'classifier' }],
        },
      },
      sensitive: {
        target: 'Structural state',
        authorization: 'Nobody',
        approvalRequired: false,
        idempotency: 'Not applicable',
      },
    });

    expect(rejected.changed).toBe(false);
    expect(rejected.notice).toBe('Step-only fields can only update Step nodes.');
    expect(rejected.state).toEqual(initial);
  });

  it('keeps v3 human-control policy data in proposal review, frozen scenarios, and downloads', () => {
    const demo = service.loadHumanControlHitlDemo(service.createInitial());
    const deploy = demo.state.graph.nodes.find((node) => node.id === 'deploy-change');
    expect(validateGraph(demo.state.graph)).toEqual([]);
    expect(deploy).toMatchObject({
      kind: 'step',
      hitl: {
        timing: 'before',
        response: {
          allowedOutcomes: [
            { id: 'approve', resumeNodeId: 'change-completed' },
            { id: 'request-changes', resumeNodeId: 'revise-change-plan' },
            { id: 'reject', resumeNodeId: 'change-cancelled' },
          ],
        },
      },
      sensitive: { approvalRequired: true },
    });

    const proposed = service.submitProposal(demo.state, {
      rationale: 'Clarify the release authorization in the review-only candidate.',
      operations: [
        {
          type: 'update_node',
          nodeId: 'deploy-change',
          patch: {
            sensitive: {
              target: 'Production deployment',
              authorization: 'Production release manager',
              approvalRequired: true,
              idempotency: 'Deployment request ID',
            },
          },
        },
      ],
    });
    expect(proposed.state.graph.nodes.find((node) => node.id === 'deploy-change')).toEqual(deploy);
    expect(proposed.state.proposal?.operations[0]).toMatchObject({
      type: 'update_node',
      patch: { sensitive: { authorization: 'Production release manager' } },
    });
    expect(service.updateNode(proposed.state, 'deploy-change', { label: 'Bypass review' }).changed).toBe(false);

    const frozen = service.freezeGraph(demo.state);
    expect(frozen.result?.ok).toBe(true);
    expect(frozen.state.scenarios.map((scenario) => scenario.humanOutcomes[0]?.outcomeId)).toEqual([
      'approve',
      'reject',
      'request-changes',
    ]);
    const graphDownload = JSON.parse(buildGraphContractDownload(frozen.state.graph).content);
    const scenarioDownload = JSON.parse(
      buildGraphScenariosDownload(frozen.state.graph, frozen.state.scenarios).content,
    );
    expect(graphDownload.nodes.find((node: { id: string }) => node.id === 'deploy-change')).toMatchObject({
      hitl: { response: { allowedOutcomes: expect.any(Array) } },
      sensitive: { approvalRequired: true },
    });
    expect(scenarioDownload.scenarios.map((scenario: { humanOutcomes: Array<{ outcomeId: string }> }) => scenario.humanOutcomes[0]?.outcomeId)).toEqual([
      'approve',
      'reject',
      'request-changes',
    ]);
  });

  it('preserves the accepted graph and every review-state proposal when reset is requested', () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Clarify the billing specialist.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    });
    const proposal = proposed.state.proposal!;

    for (const status of ['pending', 'invalid', 'stale'] as const) {
      const reviewState = { ...proposed.state, proposal: { ...proposal, status } };
      const before = structuredClone(reviewState);
      const reset = service.resetGraph(reviewState);

      expect(reset.changed).toBe(false);
      expect(reset.notice).toBe('Resolve the agent proposal before editing the accepted graph.');
      expect(reset.state).toEqual(before);
    }
  });

  it('commits a multi-node drag as one graph transition', () => {
    const initial = service.createInitial();
    const moved = service.moveNodes(initial, {
      billing: { x: 600, y: 80 },
      diagnostic: { x: 600, y: 240 },
    });

    expect(moved.changed).toBe(true);
    expect(moved.state.graph.nodes.find((node) => node.id === 'billing')?.position).toEqual({
      x: 600,
      y: 80,
    });
    expect(moved.state.graph.nodes.find((node) => node.id === 'diagnostic')?.position).toEqual({
      x: 600,
      y: 240,
    });
  });

  it('lays out the accepted graph after approving structural operations', async () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Insert fraud screening into the billing path.',
      operations: [
        { type: 'remove_edge', edgeId: 'billing-refund' },
        {
          type: 'add_node',
          node: {
            id: 'fraud-check',
            kind: 'step',
            executor: 'deterministic',
            label: 'Fraud Check',
            position: { x: 5000, y: 5000 },
          },
        },
        {
          type: 'add_edge',
          edge: { id: 'billing-fraud', source: 'billing', target: 'fraud-check', mode: 'normal' },
        },
        {
          type: 'add_edge',
          edge: { id: 'fraud-refund', source: 'fraud-check', target: 'refund', mode: 'normal' },
        },
      ],
    });
    const approved = service.approveProposal(proposed.state);
    const laidOut = await approved.layoutPromise!;

    expect(approved.result?.ok).toBe(true);
    expect(Math.max(...laidOut.nodes.map((node) => node.position.x))).toBeLessThan(2000);
    expect(laidOut.nodes.find((node) => node.id === 'fraud-check')?.position).not.toEqual({ x: 5000, y: 5000 });
  });

  it('lays out approved edge updates while preserving the accepted routing semantics', async () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Clarify the priority billing branch for review.',
      operations: [{
        type: 'update_edge',
        edgeId: 'classifier-billing',
        patch: { label: 'priority billing' },
      }],
    });

    const approved = service.approveProposal(proposed.state);
    const laidOut = await approved.layoutPromise!;
    const updated = laidOut.edges.find((edge) => edge.id === 'classifier-billing');

    expect(approved.result?.ok).toBe(true);
    expect(approved.layoutApplied).toBe(true);
    expect(updated).toMatchObject({
      source: 'classifier',
      target: 'billing',
      mode: 'conditional',
      label: 'priority billing',
    });
    expect(laidOut.nodes.find((node) => node.id === 'start')?.position).not.toEqual(
      initial.graph.nodes.find((node) => node.id === 'start')?.position,
    );
  });

  it('lays out approved subgraph geometry and membership replacements', async () => {
    const initial = service.loadResearchSupervisorDemo(service.createInitial()).state;
    const proposed = service.submitProposal(initial, {
      rationale: 'Reposition the research team container for review.',
      operations: [{
        type: 'update_subgraph',
        subgraphId: 'research-supervisor',
        patch: { position: { x: 5000, y: 5000 } },
      }],
    });

    const approved = service.approveProposal(proposed.state);
    const laidOut = await approved.layoutPromise!;

    expect(approved.result?.ok).toBe(true);
    expect(approved.layoutApplied).toBe(true);
    expect(laidOut.subgraphs.find((subgraph) => subgraph.id === 'research-supervisor')?.position).not.toEqual({
      x: 5000,
      y: 5000,
    });
  });

  it('converts positions at subgraph boundaries and preserves child coordinates when moved', () => {
    const initial = service.createInitial();
    const originalEdges = structuredClone(initial.graph.edges);
    const created = service.createSubgraph(initial, {
      label: 'Research area',
      position: { x: 400, y: 40 },
      dimensions: { width: 600, height: 360 },
    });
    const subgraphId = created.result!.subgraphId;
    const assigned = service.assignNodesToSubgraph(created.state, subgraphId, ['billing', 'diagnostic']);

    expect(assigned.state.graph.nodes.find((node) => node.id === 'billing')).toMatchObject({
      parentId: subgraphId,
      position: { x: 80, y: 20 },
    });
    expect(assigned.state.graph.nodes.find((node) => node.id === 'diagnostic')).toMatchObject({
      parentId: subgraphId,
      position: { x: 80, y: 180 },
    });

    const collapsed = service.setSubgraphCollapsed(assigned.state, subgraphId, true);
    expect(collapsed.state.graph.edges).toEqual(originalEdges);

    const moved = service.moveSubgraph(collapsed.state, subgraphId, { x: 640, y: 220 });
    expect(moved.state.graph.nodes.find((node) => node.id === 'diagnostic')?.position).toEqual({
      x: 80,
      y: 180,
    });

    const removed = service.removeNodeFromSubgraph(moved.state, 'billing');
    expect(removed.state.graph.nodes.find((node) => node.id === 'billing')?.parentId).toBeUndefined();
    expect(removed.state.graph.nodes.find((node) => node.id === 'billing')?.position).toEqual({
      x: 720,
      y: 240,
    });

    const dissolved = service.dissolveSubgraph(removed.state, subgraphId);
    expect(dissolved.state.graph.subgraphs).toEqual([]);
    expect(dissolved.state.graph.nodes.find((node) => node.id === 'diagnostic')?.parentId).toBeUndefined();
    expect(dissolved.state.graph.nodes.find((node) => node.id === 'diagnostic')?.position).toEqual({
      x: 720,
      y: 400,
    });
    expect(dissolved.state.graph.edges).toEqual(originalEdges);
  });

  it('parents a dropped node only after an unambiguous expanded-body drop and keeps coordinates canonical', () => {
    const created = service.createSubgraph(service.createInitial(), {
      label: 'Review area',
      position: { x: 400, y: 40 },
      dimensions: { width: 600, height: 360 },
    });
    const subgraphId = created.result!.subgraphId;
    const originalEdges = structuredClone(created.state.graph.edges);

    const dropped = service.moveCanvasElements(created.state, {
      billing: { x: 620, y: 150 },
    });
    const billing = dropped.state.graph.nodes.find((node) => node.id === 'billing');

    expect(dropped.changed).toBe(true);
    expect(billing).toMatchObject({
      parentId: subgraphId,
      position: { x: 220, y: 110 },
    });
    expect(dropped.state.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId)?.position).toEqual({
      x: 400,
      y: 40,
    });
    expect(dropped.state.graph.edges).toEqual(originalEdges);

    const collapsed = service.setSubgraphCollapsed(dropped.state, subgraphId, true);
    const outside = service.moveCanvasElements(collapsed.state, {
      diagnostic: { x: 650, y: 150 },
    });
    expect(outside.state.graph.nodes.find((node) => node.id === 'diagnostic')).toMatchObject({
      position: { x: 650, y: 150 },
    });
    expect(outside.state.graph.nodes.find((node) => node.id === 'diagnostic')?.parentId).toBeUndefined();
  });

  it('does not parent ambiguous drops and can convert a reparented canvas position exactly once', () => {
    let nextId = 0;
    const dropService = createWorkspaceService({
      now: () => '2026-08-29T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-${++nextId}`,
    });
    const first = dropService.createSubgraph(dropService.createInitial(), {
      position: { x: 400, y: 40 },
      dimensions: { width: 600, height: 360 },
    });
    const second = dropService.createSubgraph(first.state, {
      position: { x: 400, y: 40 },
      dimensions: { width: 600, height: 360 },
    });
    const firstId = first.result!.subgraphId;
    const secondId = second.result!.subgraphId;

    const ambiguous = dropService.moveCanvasElements(second.state, { billing: { x: 620, y: 150 } });
    expect(ambiguous.state.graph.nodes.find((node) => node.id === 'billing')?.parentId).toBeUndefined();

    const separated = dropService.updateSubgraph(ambiguous.state, secondId, {
      position: { x: 1000, y: 40 },
    });
    const assigned = dropService.moveCanvasElements(separated.state, { billing: { x: 620, y: 150 } });
    expect(assigned.state.graph.nodes.find((node) => node.id === 'billing')).toMatchObject({
      parentId: firstId,
      position: { x: 220, y: 110 },
    });

    const reparented = dropService.moveCanvasElements(assigned.state, { billing: { x: 620, y: 110 } });
    expect(reparented.state.graph.nodes.find((node) => node.id === 'billing')).toMatchObject({
      parentId: secondId,
      position: { x: 20, y: 110 },
    });
  });

  it('loads a valid Research Supervisor demo and locks all subgraph edits during review or freeze', () => {
    const demo = service.loadResearchSupervisorDemo(service.createInitial());
    expect(validateGraph(demo.state.graph)).toEqual([]);

    const proposed = service.submitProposal(demo.state, {
      rationale: 'Clarify the supervisor role.',
      operations: [
        {
          type: 'update_node',
          nodeId: 'research-supervisor-agent',
          patch: { label: 'Research Supervisor' },
        },
      ],
    });
    expect(proposed.result?.proposal.status).toBe('pending');
    const pendingCollapse = service.setSubgraphCollapsed(
      proposed.state,
      'research-supervisor',
      true,
    );
    expect(pendingCollapse.changed).toBe(false);

    const frozen = service.freezeGraph(demo.state);
    expect(frozen.result?.ok).toBe(true);
    expect(service.createSubgraph(frozen.state, { position: { x: 0, y: 0 } }).changed).toBe(false);
    expect(
      service.dissolveSubgraph(frozen.state, 'research-supervisor').changed,
    ).toBe(false);
    expect(service.loadResearchSupervisorDemo(proposed.state).changed).toBe(false);
    expect(service.loadResearchSupervisorDemo(frozen.state).changed).toBe(false);
  });

  it('loads the canonical Research Intake Routing demo only while the accepted graph is editable', () => {
    const demo = service.loadResearchIntakeRoutingDemo(service.createInitial());
    expect(demo.changed).toBe(true);
    expect(demo.state.graph).toMatchObject({
      id: 'research-intake-routing-demo',
      name: 'Research Intake Routing',
    });
    expect(validateGraph(demo.state.graph)).toEqual([]);

    const proposed = service.submitProposal(demo.state, {
      rationale: 'Review the command destination.',
      operations: [
        {
          type: 'update_edge',
          edgeId: 'clarify-write-brief',
          patch: { label: 'ready for review' },
        },
      ],
    });
    expect(service.loadResearchIntakeRoutingDemo(proposed.state).changed).toBe(false);

    const frozen = service.freezeGraph(demo.state);
    expect(frozen.result?.ok).toBe(true);
    expect(service.loadResearchIntakeRoutingDemo(frozen.state).changed).toBe(false);
  });

  it('loads a valid library graph only through the editable accepted-graph boundary', () => {
    const entry = {
      title: 'Library workflow',
      graph: { ...structuredClone(researchSupervisorGraph), id: 'library-workflow' },
    };
    const loaded = service.loadGraphLibraryEntry(service.createInitial(), entry);
    expect(loaded.changed).toBe(true);
    expect(loaded.state.graph).toMatchObject({
      id: 'library-workflow',
      status: 'draft',
    });
    expect(loaded.state.scenarios).toEqual([]);
    expect(loaded.layoutApplied).toBe(true);

    const proposed = service.submitProposal(loaded.state, {
      rationale: 'Keep accepted state review-only.',
      operations: [{ type: 'update_node', nodeId: 'research-supervisor-agent', patch: { label: 'Reviewed supervisor' } }],
    });
    expect(service.loadGraphLibraryEntry(proposed.state, entry).changed).toBe(false);

    const frozen = service.freezeGraph(loaded.state);
    expect(frozen.result?.ok).toBe(true);
    expect(service.loadGraphLibraryEntry(frozen.state, entry).changed).toBe(false);
  });

  it('supports inspector-level subgraph label, size, membership, collapse, and dissolve edits', () => {
    const created = service.createSubgraph(service.createInitial(), {
      // Keep this inspector-edit fixture clear of the sample graph so the
      // resize constraint is not exercising sibling collision behavior.
      position: { x: 1_600, y: 100 },
    });
    const subgraphId = created.result!.subgraphId;
    const configured = service.updateSubgraph(created.state, subgraphId, {
      label: 'Triage workspace',
      dimensions: { width: 720, height: 420 },
    });
    const assigned = service.assignNodesToSubgraph(configured.state, subgraphId, ['billing']);
    const collapsed = service.setSubgraphCollapsed(assigned.state, subgraphId, true);

    expect(collapsed.state.graph.subgraphs[0]).toMatchObject({
      label: 'Triage workspace',
      dimensions: { width: 720, height: 420 },
      collapsed: true,
    });
    expect(collapsed.state.graph.nodes.find((node) => node.id === 'billing')?.parentId).toBe(subgraphId);

    const dissolved = service.dissolveSubgraph(collapsed.state, subgraphId);
    expect(dissolved.state.graph.subgraphs).toEqual([]);
    const billing = dissolved.state.graph.nodes.find((node) => node.id === 'billing');
    expect(billing?.position).toEqual({ x: 480, y: 60 });
    expect(billing).not.toHaveProperty('parentId');
  });

  it('persists dynamic worker movement and size through the canonical Send template owner', () => {
    const libraryGraph = structuredClone(
      graphLibraryEntries.find((entry) => entry.id === 'hierarchical-deep-research')!.graph,
    );
    const initial = service.createInitial();
    const state = { ...initial, graph: libraryGraph };
    const before = dynamicWorkerGroupLayout(state.graph, 'dispatch-send')!;

    const moved = service.moveDynamicWorkerGroup(state, 'dispatch-send', {
      x: before.position.x + 24,
      y: before.position.y - 18,
    });
    expect(dynamicWorkerGroupLayout(moved.state.graph, 'dispatch-send')?.position).toEqual({
      x: before.position.x + 24,
      y: before.position.y - 18,
    });
    expect(moved.state.graph.edges.find((edge) => edge.id === 'dispatch-send')?.send)
      .toMatchObject({ templateAnatomy: { dimensions: before.dimensions } });

    const resized = service.resizeDynamicWorkerGroup(moved.state, 'dispatch-send', {
      width: before.dimensions.width + 18,
      height: before.dimensions.height,
    });
    expect(dynamicWorkerGroupLayout(resized.state.graph, 'dispatch-send')?.dimensions).toEqual({
      width: before.dimensions.width + 18,
      height: before.dimensions.height,
    });

    const frozen = { ...resized.state, graph: { ...resized.state.graph, status: 'frozen' as const } };
    expect(service.moveDynamicWorkerGroup(frozen, 'dispatch-send', { x: 0, y: 0 }).changed).toBe(false);
    expect(service.resizeDynamicWorkerGroup(frozen, 'dispatch-send', { width: 400, height: 300 }).changed).toBe(false);
  });
});
