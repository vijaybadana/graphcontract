import { describe, expect, it } from 'vitest';

import { createWorkspaceService } from '@/src/application/workspace';
import { sampleGraph } from '@/src/domain';
import { migrateWorkspaceV2 } from './migrate-workspace';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

describe('workspace persistence migration', () => {
  it('replaces an invalid saved demo with the valid initial workflow', () => {
    const invalid = structuredClone(sampleGraph);
    invalid.edges.push({ id: 'refund-extra', source: 'refund', target: 'end', mode: 'normal' });

    const migrated = migrateWorkspaceV2(
      { graph: invalid, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.edges).toHaveLength(sampleGraph.edges.length);
  });

  it('renames the old generic demo action without changing its identity', () => {
    const graph = structuredClone(sampleGraph);
    graph.nodes.find((node) => node.id === 'diagnostic')!.label = 'New Action';

    const migrated = migrateWorkspaceV2(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.nodes.find((node) => node.id === 'diagnostic')?.label).toBe(
      'Post-Refund Audit',
    );
  });
});
