import { buildGraphContractDownload, buildGraphScenariosDownload } from '@/src/adapters/exports/downloads';
import { migrateWorkspaceV7 } from '@/src/adapters/persistence/migrate-workspace';
import { enumerateScenarios, enumerateScenariosBounded, validateGraph, workflowGraphSchema } from '@/src/domain';
import { describe, expect, it, vi } from 'vitest';

import {
  createGraphLibraryEntries,
  graphLibraryEntries,
  validateGraphLibraryDefinitions,
} from './graph-library';
import { GRAPH_LIBRARY_ENTRY_COUNT, cloneGraphLibraryGraph } from './graph-library-contract';
import { layoutWorkflowGraph } from './layout-workflow';

describe('graph library registry', () => {
  it('contains exactly ten distinct, safe, schema-v6 graph templates', () => {
    expect(graphLibraryEntries).toHaveLength(GRAPH_LIBRARY_ENTRY_COUNT);
    expect(new Set(graphLibraryEntries.map((entry) => entry.id)).size).toBe(GRAPH_LIBRARY_ENTRY_COUNT);
    for (const entry of graphLibraryEntries) {
      expect(entry.source.url).toBe(`https://github.com/${entry.source.owner}/${entry.source.repository}`);
      expect(entry.source.url).toMatch(/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+$/);
      expect(entry.graph.schemaVersion).toBe('6');
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

  it('models source-backed hierarchical research with a bounded nested worker pool', () => {
    const entry = graphLibraryEntries.find((candidate) => candidate.id === 'hierarchical-deep-research')!;
    const supervisor = entry.graph.subgraphs.find((subgraph) => subgraph.id === 'research-cell')!;
    const researcherSubgraph = entry.graph.subgraphs.find(
      (subgraph) => subgraph.id === 'researcher-workflow',
    )!;
    const supervisorMembers = entry.graph.nodes.filter((node) => node.parentId === supervisor.id);
    const researcherMembers = entry.graph.nodes.filter(
      (node) => node.parentId === researcherSubgraph.id,
    );
    const researcher = entry.graph.nodes.find((node) => node.id === 'researcher-agent');
    const merge = entry.graph.nodes.find((node) => node.id === 'research-merge');
    const send = entry.graph.edges.find((edge) => edge.id === 'dispatch-send');

    expect(entry.graph.id).toBe('library-hierarchical-deep-research');
    expect(supervisor).toMatchObject({ label: 'Research Supervisor', collapsed: false });
    expect(researcherSubgraph).toMatchObject({
      label: 'Researcher ×N',
      parentId: 'research-cell',
      collapsed: false,
      dimensions: { width: 1500, height: 620 },
    });
    expect(entry.layout).toMatchObject({
      preserveGraphGeometry: true,
      authoredSubgraphIds: ['research-cell', 'researcher-workflow'],
    });
    expect(supervisorMembers.map((node) => node.id)).toEqual(expect.arrayContaining([
      'research-cell-start',
      'frame-question',
      'review-findings',
      'research-cell-end',
    ]));
    expect(researcherMembers.map((node) => node.id)).toEqual(expect.arrayContaining([
      'researcher-start',
      'dispatch-research',
      'researcher-agent',
      'research-merge',
      'researcher-end',
    ]));
    expect(researcher).toMatchObject({ kind: 'step', executor: 'ai', label: 'Researcher Agent' });
    expect(merge).toMatchObject({
      kind: 'merge',
      merge: {
        reducer: { name: 'merge_research_notes', aggregateState: 'researchNotes' },
        completion: { mode: 'all' },
        waitingForDynamicInputs: true,
      },
    });
    expect(send).toMatchObject({
      mode: 'send',
      source: 'dispatch-research',
      target: 'researcher-agent',
      send: {
        destinationTemplateId: 'researcher-agent',
        multiplicity: 'dynamic',
        payloadLabel: 'research task',
        mergeNodeId: 'research-merge',
        payloadSchemaRef: 'ConductResearch.research_topic',
        templateAnatomy: {
          canonicalTemplateNodeId: 'researcher-agent',
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: 'researcher-worker-start', kind: 'start' }),
            expect.objectContaining({ id: 'researcher-agent', kind: 'step', executor: 'ai' }),
            expect.objectContaining({ id: 'research-tools', kind: 'step', executor: 'tool' }),
            expect.objectContaining({ id: 'compress-findings', kind: 'step', executor: 'ai' }),
            expect.objectContaining({ id: 'researcher-worker-end', kind: 'end' }),
          ]),
        },
      },
    });
    expect(entry.graph.edges.find((edge) => edge.id === 'researcher-supervisor-loop')).toMatchObject({
      source: 'review-findings',
      target: 'frame-question',
      label: 'research more',
      loopCap: 5,
    });
    expect(entry.graph.edges.find((edge) => edge.id === 'frame-researcher')).toMatchObject({
      source: 'frame-question',
      target: 'researcher-start',
      label: 'conduct research',
    });
    expect(entry.graph.edges.find((edge) => edge.id === 'frame-complete')).toMatchObject({
      source: 'review-findings',
      target: 'research-cell-end',
      label: 'research complete',
    });
    expect(entry.graph.edges.some((edge) => (
      edge.source === 'frame-question' && edge.target === 'research-cell-end'
    ))).toBe(false);
    expect(entry.graph.edges.find((edge) => edge.id === 'merge-researcher-end')).toMatchObject({
      source: 'research-merge',
      target: 'researcher-end',
    });
    expect(entry.graph.edges.some((edge) => edge.id === 'merge-tools')).toBe(false);
    expect(entry.graph.edges.some((edge) => edge.id === 'tools-compress')).toBe(false);
    expect(supervisor.dimensions).toEqual({ width: 1930, height: 1080 });
    expect(researcher?.position).toEqual({ x: 370, y: 302 });
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

  it('materializes template geometry with the shared deterministic auto-layout', async () => {
    const sourceDefinitions = structuredClone(graphLibraryEntries);
    const unlaidGraph = sourceDefinitions[0]!.graph;
    unlaidGraph.nodes = unlaidGraph.nodes.map((node) => ({ ...node, position: { x: 0, y: 0 } }));
    unlaidGraph.subgraphs = unlaidGraph.subgraphs.map((subgraph) => ({ ...subgraph, position: { x: 0, y: 0 } }));

    const materialized = await createGraphLibraryEntries(sourceDefinitions);
    expect(materialized[0]!.graph).toEqual(await layoutWorkflowGraph(unlaidGraph));
  });

  it('retains the original breadth while allowing focused built-in verification variants', () => {
    const signatures = graphLibraryEntries.map((entry) => ({
      subgraph: entry.graph.subgraphs.length > 0,
      send: entry.graph.edges.some((edge) => edge.mode === 'send'),
      merge: entry.graph.nodes.some((node) => node.kind === 'merge'),
      hitl: entry.graph.nodes.some((node) => node.kind === 'step' && node.hitl?.enabled),
      command: entry.graph.edges.some((edge) => edge.mode === 'command'),
      opaque: entry.graph.nodes.some((node) => node.kind === 'step' && node.opaque !== undefined),
      loop: entry.graph.edges.some((edge) => edge.loopCap !== undefined),
    }));
    expect(new Set(signatures.map((signature) => JSON.stringify(signature))).size).toBeGreaterThanOrEqual(10);
  });

  it('uses canonical opaque metadata rather than presentation-only legacy flags', () => {
    const opaqueSteps = graphLibraryEntries.flatMap((entry) =>
      entry.graph.nodes.filter((node) => node.kind === 'step' && node.opaque),
    );

    expect(opaqueSteps.length).toBeGreaterThan(0);
    for (const node of opaqueSteps) {
      if (node.kind !== 'step') throw new Error('Expected an opaque Step.');
      expect(node.opaque).toMatchObject({
        factoryLabel: expect.any(String),
        inputPorts: [],
        outputPorts: [],
        runtimeInspection: { available: false },
      });
    }
  });

  it('round-trips each graph through export and workspace rehydration', () => {
    for (const entry of graphLibraryEntries) {
      const cloned = cloneGraphLibraryGraph(entry);
      expect(cloned).not.toBe(entry.graph);
      const exported = JSON.parse(buildGraphContractDownload(cloned).content);
      const parsed = workflowGraphSchema.parse(exported);
      const rehydrated = migrateWorkspaceV7({ graph: parsed }, () => {
        throw new Error('A valid schema-v6 graph must not use the fallback workspace.');
      });
      expect(rehydrated.graph).toEqual(parsed);
      expect(JSON.parse(buildGraphScenariosDownload(parsed, entry.scenarioSummary.scenarios).content).scenarios).toEqual(entry.scenarioSummary.scenarios);
    }
  });

  it('creates derived entries only from a valid registry', async () => {
    expect(await createGraphLibraryEntries(graphLibraryEntries)).toHaveLength(GRAPH_LIBRARY_ENTRY_COUNT);
  });

  it('validates and materializes each registry graph with one enumeration pass', async () => {
    const enumerate = vi.fn(enumerateScenariosBounded);

    const entries = await createGraphLibraryEntries(graphLibraryEntries, enumerate);

    expect(entries).toHaveLength(GRAPH_LIBRARY_ENTRY_COUNT);
    expect(enumerate).toHaveBeenCalledTimes(GRAPH_LIBRARY_ENTRY_COUNT);
    expect(new Set(enumerate.mock.calls.map(([graph]) => graph.id)).size).toBe(
      GRAPH_LIBRARY_ENTRY_COUNT,
    );
  });
});
