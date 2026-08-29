import { describe, expect, it } from 'vitest';

import { createWorkspaceService } from '@/src/application/workspace';
import { researchIntakeRoutingGraph, sampleGraph } from '@/src/domain';
import { migrateWorkspaceV3 } from './migrate-workspace';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

describe('workspace persistence migration', () => {
  it('replaces an invalid saved demo with the valid initial workflow', () => {
    const invalid = structuredClone(sampleGraph);
    invalid.edges.push({ id: 'refund-extra', source: 'refund', target: 'end', mode: 'normal' });

    const migrated = migrateWorkspaceV3(
      { graph: invalid, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.edges).toHaveLength(sampleGraph.edges.length);
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

    const migrated = migrateWorkspaceV3(
      { graph: legacy, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      nodes: sampleGraph.nodes,
      edges: sampleGraph.edges,
      subgraphs: [],
    });
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
});
