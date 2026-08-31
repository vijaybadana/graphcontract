import {
  buildGraphContractDownload,
  buildGraphScenariosDownload,
} from '@/src/adapters/exports/downloads';
import { migrateWorkspaceV7 } from '@/src/adapters/persistence/migrate-workspace';
import {
  validateGraph,
  workflowGraphSchema,
} from '@/src/domain';
import { describe, expect, it } from 'vitest';

import { graphLibraryEntries } from './graph-library';
import type { GraphLibraryEntry } from './graph-library-contract';
import { createWorkspaceService } from './workspace';

const TEMPLATE_IDS = [
  'hierarchical-deep-research',
  'guarded-coding-agent-delivery',
  'evidence-to-approved-social-content',
  'multi-stage-expert-review',
  'guarded-natural-language-to-sql',
  'email-triage-with-human-review',
  'human-approved-incident-response',
  'specialist-travel-support',
  'voice-specialist-handoffs',
  'parallel-research-with-reflection',
] as const;

const service = createWorkspaceService({
  now: () => '2026-08-31T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-integration`,
});

function libraryEntryByStableId(id: (typeof TEMPLATE_IDS)[number]): GraphLibraryEntry {
  const entry = graphLibraryEntries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Missing graph library template: ${id}`);
  return entry;
}

describe('graph library all-template integration', () => {
  it.each(TEMPLATE_IDS)('%s preserves canonical and scenario truth through load, export, and reload', (entryId) => {
    const entry = libraryEntryByStableId(entryId);
    const fixtureGraphBefore = structuredClone(entry.graph);

    expect(entry.graph.id).toBe(`library-${entryId}`);

    const loaded = service.loadGraphLibraryEntry(service.createInitial(), entry);
    expect(loaded).toMatchObject({ changed: true, layoutApplied: true });
    expect(loaded.state.graph).not.toBe(entry.graph);
    expect(loaded.state.graph.id).toBe(entry.graph.id);
    expect(validateGraph(loaded.state.graph)).toEqual([]);

    const frozen = service.freezeGraph(loaded.state);
    expect(frozen.result?.ok).toBe(true);
    expect(frozen.state.graph.status).toBe('frozen');
    expect(frozen.state.scenarios).toEqual(entry.scenarioSummary.scenarios);
    expect(frozen.state.scenarios.length).toBeGreaterThan(0);
    expect(frozen.state.scenarios.length).toBeLessThanOrEqual(200);

    const exportedGraph = workflowGraphSchema.parse(
      JSON.parse(buildGraphContractDownload(frozen.state.graph).content),
    );
    const exportedScenarios = JSON.parse(
      buildGraphScenariosDownload(frozen.state.graph, frozen.state.scenarios).content,
    ) as {
      graphId: string;
      graphSchemaVersion: string;
      graphCapabilities: unknown;
      graphRelationships: unknown;
      scenarios: unknown;
    };
    const serializableScenarios = JSON.parse(JSON.stringify(frozen.state.scenarios));

    expect(exportedGraph).toEqual(frozen.state.graph);
    expect(exportedScenarios).toMatchObject({
      graphId: frozen.state.graph.id,
      graphSchemaVersion: frozen.state.graph.schemaVersion,
      graphCapabilities: frozen.state.graph.capabilities,
      graphRelationships: frozen.state.graph.relationships,
      scenarios: serializableScenarios,
    });

    const persistedWorkspace = JSON.parse(JSON.stringify({
      graph: exportedGraph,
      proposal: null,
      // Scenarios are projection-only. Reload must derive them from the frozen
      // graph rather than trust an absent or stale persisted array.
      scenarios: [],
    }));
    const rehydrated = migrateWorkspaceV7(
      persistedWorkspace,
      () => {
        throw new Error(`Valid exported template unexpectedly used fallback: ${entryId}`);
      },
    );

    expect(rehydrated.graph).toEqual(exportedGraph);
    expect(rehydrated.scenarios).toEqual(serializableScenarios);
    expect(entry.graph).toEqual(fixtureGraphBefore);
  }, 15_000);
});
