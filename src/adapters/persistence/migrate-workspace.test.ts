import { describe, expect, it } from 'vitest';

import { createWorkspaceService } from '@/src/application/workspace';
import {
  createProposal,
  enumerateScenarios,
  researchIntakeRoutingGraph,
  sampleGraph,
  validateGraph,
} from '@/src/domain';
import { migrateWorkspaceV3 } from './migrate-workspace';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

describe('workspace persistence migration', () => {
  it('preserves schema-safe incomplete drafts for ordinary validation', () => {
    const invalid = structuredClone(sampleGraph);
    invalid.nodes.push({
      id: 'unfinished-agent',
      kind: 'agent',
      label: 'Unfinished agent',
      position: { x: 900, y: 120 },
    });
    invalid.edges.push({
      id: 'unfinished-edge',
      source: 'diagnostic',
      target: 'not-yet-created',
      mode: 'normal',
    });
    invalid.subgraphs.push({
      id: 'empty-subgraph',
      label: 'Unfinished subgraph',
      position: { x: 900, y: 280 },
      dimensions: { width: 320, height: 200 },
      collapsed: false,
    });

    const migrated = migrateWorkspaceV3(
      { graph: invalid, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      nodes: expect.arrayContaining([expect.objectContaining({ id: 'unfinished-agent' })]),
      edges: expect.arrayContaining([
        expect.objectContaining({
          id: 'unfinished-edge',
          source: 'diagnostic',
          target: 'not-yet-created',
        }),
      ]),
      subgraphs: expect.arrayContaining([expect.objectContaining({ id: 'empty-subgraph' })]),
    });
    expect(validateGraph(migrated.graph!).map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['MISSING_EDGE_NODE', 'OUTGOING_REQUIRED', 'SUBGRAPH_START_COUNT']),
    );
  });

  it('falls back only when the saved graph shape cannot be parsed', () => {
    const migrated = migrateWorkspaceV3(
      { graph: { ...sampleGraph, nodes: 'corrupt' }, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      nodes: sampleGraph.nodes,
      edges: sampleGraph.edges,
    });
  });

  it('renames the old generic demo action without changing its identity', () => {
    const graph = structuredClone(sampleGraph);
    graph.nodes.find((node) => node.id === 'diagnostic')!.label = 'New Action';

    const migrated = migrateWorkspaceV3(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.nodes.find((node) => node.id === 'diagnostic')?.label).toBe(
      'Post-Refund Audit',
    );
  });

  it('preserves valid pre-command graph data and supplies its empty subgraph collection', () => {
    const legacy = structuredClone(sampleGraph);
    delete (legacy as { subgraphs?: unknown }).subgraphs;
    const proposalResult = createProposal(sampleGraph, {
      operations: [
        {
          type: 'update_node',
          nodeId: 'billing',
          patch: { description: 'Keep the saved review state.' },
        },
      ],
      rationale: 'Keep the saved review state.',
    });
    expect(proposalResult.proposal).toBeDefined();
    const proposal = proposalResult.proposal!;
    const scenarios = enumerateScenarios(sampleGraph);

    const migrated = migrateWorkspaceV3(
      { graph: legacy, proposal, scenarios },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      nodes: sampleGraph.nodes,
      edges: sampleGraph.edges,
      subgraphs: [],
    });
    expect(migrated.proposal).toMatchObject({
      id: proposal.id,
      status: 'pending',
      operations: proposal.operations,
    });
    expect(migrated.scenarios).toEqual(scenarios);
  });

  it('keeps a persisted Command graph with a topology-derived loop', () => {
    const migrated = migrateWorkspaceV3(
      { graph: structuredClone(researchIntakeRoutingGraph), proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: researchIntakeRoutingGraph.id,
      edges: expect.arrayContaining([
        expect.objectContaining({ mode: 'command', label: 'ready' }),
        expect.objectContaining({
          id: 'researcher-continue',
          mode: 'normal',
          source: 'researcher',
          target: 'research-supervisor',
        }),
      ]),
    });
  });

  it('normalizes stale route fields while preserving the persisted graph', () => {
    const legacy = structuredClone(researchIntakeRoutingGraph);
    legacy.edges.find((edge) => edge.id === 'researcher-continue')!.condition =
      'state.shouldContinue === true';
    legacy.edges.find((edge) => edge.id === 'supervisor-human-review')!.label = 'otherwise';
    legacy.edges.find((edge) => edge.id === 'supervisor-human-review')!.condition =
      'state.unhandled === true';
    legacy.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = ' ready ';
    legacy.edges.find((edge) => edge.id === 'clarify-write-brief')!.condition = '   ';

    const migrated = migrateWorkspaceV3(
      { graph: legacy, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.edges.find((edge) => edge.id === 'researcher-continue')).toEqual({
      id: 'researcher-continue',
      source: 'researcher',
      target: 'research-supervisor',
      mode: 'normal',
      label: 'continue',
    });
    expect(migrated.graph?.edges.find((edge) => edge.id === 'supervisor-human-review')).toEqual({
      id: 'supervisor-human-review',
      source: 'research-supervisor',
      target: 'human-review',
      mode: 'fallback',
      label: 'fallback',
    });
    expect(migrated.graph?.edges.find((edge) => edge.id === 'clarify-write-brief')).toMatchObject({
      mode: 'command',
      label: 'ready',
    });
    expect(migrated.graph?.edges.find((edge) => edge.id === 'clarify-write-brief')).toMatchObject({
      condition: '',
    });
    expect(validateGraph(migrated.graph!).map((entry) => entry.code)).toContain(
      'COMMAND_CONDITION_REQUIRED',
    );
  });
});
