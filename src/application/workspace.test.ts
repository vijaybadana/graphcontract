import { describe, expect, it } from 'vitest';

import { validateGraph } from '@/src/domain';
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
    expect(approved.state.graph.edges).toContainEqual({
      id: 'billing-classifier-return',
      source: 'billing',
      target: 'classifier',
      mode: 'normal',
    });
  });

  it('approves a valid subgraph proposal through the human path and keeps child coordinates relative', () => {
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
    expect(approved.state.graph.subgraphs[0]?.position).toEqual({ x: 340, y: 180 });
    expect(approved.state.graph.nodes.find((node) => node.id === 'research-supervisor-agent')?.position).toEqual({
      x: 220,
      y: 130,
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

  it('keeps expectedGraphUpdatedAt optional but rejects supplied stale values and human stale approval', () => {
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
    const stale = service.approveProposal({
      ...compatible.state,
      graph: { ...compatible.state.graph, updatedAt: '2026-08-29T00:00:00.000Z' },
    });

    expect(compatible.result?.ok).toBe(true);
    expect(mismatched.result).toEqual({
      ok: false,
      error: {
        code: 'PROPOSAL_STALE',
        message: 'The accepted graph changed. Read it again before proposing changes.',
      },
    });
    expect(stale.result).toEqual({
      ok: false,
      error: {
        code: 'PROPOSAL_STALE',
        message: 'The graph changed after this proposal was created.',
      },
    });
    expect(stale.state.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Billing Agent');
    expect(stale.state.proposal?.status).toBe('stale');
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

  it('lays out the accepted graph after approving structural operations', () => {
    const initial = service.createInitial();
    const proposed = service.submitProposal(initial, {
      rationale: 'Insert fraud screening into the billing path.',
      operations: [
        { type: 'remove_edge', edgeId: 'billing-refund' },
        {
          type: 'add_node',
          node: {
            id: 'fraud-check',
            kind: 'action',
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

    expect(approved.result?.ok).toBe(true);
    expect(Math.max(...approved.state.graph.nodes.map((node) => node.position.x))).toBeLessThan(1600);
    expect(approved.state.graph.nodes.find((node) => node.id === 'fraud-check')?.position).not.toEqual({ x: 5000, y: 5000 });
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

  it('supports inspector-level subgraph label, size, membership, collapse, and dissolve edits', () => {
    const created = service.createSubgraph(service.createInitial(), {
      position: { x: 300, y: 100 },
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
});
