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
