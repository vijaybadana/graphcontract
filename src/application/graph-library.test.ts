import { buildGraphContractDownload, buildGraphScenariosDownload } from '@/src/adapters/exports/downloads';
import { migrateWorkspaceV6 } from '@/src/adapters/persistence/migrate-workspace';
import { enumerateScenarios, validateGraph, workflowGraphSchema } from '@/src/domain';
import { describe, expect, it } from 'vitest';

import {
  createGraphLibraryEntries,
  graphLibraryEntries,
  validateGraphLibraryDefinitions,
} from './graph-library';
import { GRAPH_LIBRARY_ENTRY_COUNT, cloneGraphLibraryGraph } from './graph-library-contract';

describe('graph library registry', () => {
  it('contains exactly ten distinct, safe, schema-v5 graph templates', () => {
    expect(graphLibraryEntries).toHaveLength(GRAPH_LIBRARY_ENTRY_COUNT);
    expect(new Set(graphLibraryEntries.map((entry) => entry.id)).size).toBe(GRAPH_LIBRARY_ENTRY_COUNT);
    for (const entry of graphLibraryEntries) {
      expect(entry.source.url).toBe(`https://github.com/${entry.source.owner}/${entry.source.repository}`);
      expect(entry.source.url).toMatch(/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+$/);
      expect(entry.graph.schemaVersion).toBe('5');
      expect(workflowGraphSchema.safeParse(entry.graph).success).toBe(true);
      expect(validateGraph(entry.graph)).toEqual([]);
    }
  });

  it('declares source-backed durability without turning it into topology', () => {
    const entry = (id: string) => graphLibraryEntries.find((candidate) => candidate.id === id)!.graph;

    const deepResearch = entry('hierarchical-deep-research');
    expect(deepResearch.capabilities).toMatchObject({
      state: { enabled: true },
      checkpointer: { enabled: false },
      store: { available: false },
    });

    const social = entry('evidence-to-approved-social-content');
    expect(social.capabilities.store).toMatchObject({ available: true, namespace: 'saved_data' });
    expect(social.nodes.find((node) => node.id === 'draft-template')).toMatchObject({
      storeAccess: { read: { namespace: 'saved_data' }, write: { namespace: 'saved_data' } },
    });

    const email = entry('email-triage-with-human-review');
    expect(email.capabilities.store).toMatchObject({ available: true, namespace: 'preferences' });
    expect(email.nodes.find((node) => node.id === 'classify-message')).toMatchObject({
      storeAccess: { read: { key: 'profile' } },
    });

    const sql = entry('guarded-natural-language-to-sql');
    expect(sql.capabilities.checkpointer).toMatchObject({
      enabled: true,
      backend: 'MemorySaver',
      durableThread: { required: true },
    });

    const voice = entry('voice-specialist-handoffs');
    expect(voice.capabilities).toMatchObject({
      runtimeMode: { mode: 'voice', input: 'audio' },
      checkpointer: { enabled: false },
      store: { available: false },
    });
    expect(voice.edges.some((edge) => edge.loopCap !== undefined)).toBe(false);
    expect(voice.nodes.some((node) => node.kind === 'step' && node.retry !== undefined)).toBe(false);
  });

  it('rejects duplicate IDs, unsafe sources, and invalid graph inputs', () => {
    const duplicate = structuredClone(graphLibraryEntries[0]!);
    const unsafe = structuredClone(graphLibraryEntries[1]!);
    unsafe.source.url = 'https://example.com/not-github' as `https://github.com/${string}`;
    const invalid = structuredClone(graphLibraryEntries[2]!);
    invalid.graph.nodes[0]!.id = '';

    expect(validateGraphLibraryDefinitions([
      ...graphLibraryEntries,
      duplicate,
      unsafe,
      invalid,
    ])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DUPLICATE_ID' }),
      expect.objectContaining({ code: 'INVALID_SOURCE', entryId: unsafe.id }),
      expect.objectContaining({ code: 'INVALID_GRAPH', entryId: invalid.id }),
    ]));
  });

  it('derives deterministic bounded scenarios through the ordinary service', () => {
    for (const entry of graphLibraryEntries) {
      const first = enumerateScenarios(entry.graph);
      expect(first).toEqual(enumerateScenarios(entry.graph));
      expect(first).toEqual(entry.scenarioSummary.scenarios);
      expect(entry.scenarioSummary.pathCount).toBe(first.length);
      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBeLessThanOrEqual(200);
    }
  });

  it('has distinct supported topology signatures', () => {
    const signatures = graphLibraryEntries.map((entry) => ({
      subgraph: entry.graph.subgraphs.length > 0,
      send: entry.graph.edges.some((edge) => edge.mode === 'send'),
      merge: entry.graph.nodes.some((node) => node.kind === 'merge'),
      hitl: entry.graph.nodes.some((node) => node.kind === 'step' && node.hitl?.enabled),
      command: entry.graph.edges.some((edge) => edge.mode === 'command'),
      opaque: entry.graph.nodes.some((node) => node.kind === 'step' && node.modifiers?.opaque),
      loop: entry.graph.edges.some((edge) => edge.loopCap !== undefined),
    }));
    expect(new Set(signatures.map((signature) => JSON.stringify(signature))).size).toBe(GRAPH_LIBRARY_ENTRY_COUNT);
  });

  it('round-trips each graph through export and workspace rehydration', () => {
    for (const entry of graphLibraryEntries) {
      const cloned = cloneGraphLibraryGraph(entry);
      expect(cloned).not.toBe(entry.graph);
      const exported = JSON.parse(buildGraphContractDownload(cloned).content);
      const parsed = workflowGraphSchema.parse(exported);
      const rehydrated = migrateWorkspaceV6({ graph: parsed }, () => {
        throw new Error('A valid schema-v5 graph must not use the fallback workspace.');
      });
      expect(rehydrated.graph).toEqual(parsed);
      expect(JSON.parse(buildGraphScenariosDownload(parsed, entry.scenarioSummary.scenarios).content).scenarios).toEqual(entry.scenarioSummary.scenarios);
    }
  });

  it('creates derived entries only from a valid registry', () => {
    expect(createGraphLibraryEntries(graphLibraryEntries)).toHaveLength(GRAPH_LIBRARY_ENTRY_COUNT);
  });
});
