import { describe, expect, it } from 'vitest';

import { createWorkspaceService } from '@/src/application/workspace';
import {
  createProposal,
  enumerateScenarios,
  researchIntakeRoutingGraph,
  sampleGraph,
  validateGraph,
  WorkflowGraphV1,
  WorkflowGraphV3,
} from '@/src/domain';
import { migrateWorkspaceV5 } from './migrate-workspace';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

const legacyV1Graph = (): WorkflowGraphV1 => {
  const graph = structuredClone(sampleGraph);
  const legacyKinds: Record<string, string> = {
    classifier: 'agent',
    billing: 'agent',
    diagnostic: 'action',
    human: 'human_input',
    refund: 'tool',
  };

  return {
    ...graph,
    schemaVersion: '1' as const,
    nodes: graph.nodes.map((node) => {
      const legacy = { ...node } as Record<string, unknown>;
      delete legacy.executor;
      delete legacy.participation;
      delete legacy.modifiers;
      return { ...legacy, kind: legacyKinds[node.id] ?? node.kind };
    }),
  } as unknown as WorkflowGraphV1;
};

describe('workspace persistence migration', () => {
  it('preserves schema-safe incomplete drafts for ordinary validation', () => {
    const invalid = legacyV1Graph();
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

    const migrated = migrateWorkspaceV5(
      { graph: invalid, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      schemaVersion: '4',
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'unfinished-agent', kind: 'step', executor: 'ai' }),
      ]),
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
    const migrated = migrateWorkspaceV5(
      { graph: { ...legacyV1Graph(), nodes: 'corrupt' }, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      nodes: sampleGraph.nodes,
      edges: sampleGraph.edges,
    });
  });

  it('preserves legacy labels and descriptions while changing only taxonomy', () => {
    const graph = legacyV1Graph();
    graph.nodes.find((node) => node.id === 'diagnostic')!.label = 'New Action';
    graph.nodes.find((node) => node.id === 'diagnostic')!.description = 'Keep this exact detail.';

    const migrated = migrateWorkspaceV5(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.nodes.find((node) => node.id === 'diagnostic')).toMatchObject({
      id: 'diagnostic',
      kind: 'step',
      executor: 'deterministic',
      label: 'New Action',
      description: 'Keep this exact detail.',
    });
  });

  it('maps every legacy work kind without conflating tool participation or HITL', () => {
    const legacy = legacyV1Graph();
    const classifier = legacy.nodes.find((node) => node.id === 'classifier')!;
    const diagnostic = legacy.nodes.find((node) => node.id === 'diagnostic')!;
    classifier.config = { tools: ['lookup'] };
    diagnostic.hitl = { enabled: true, timing: 'before', inputType: 'approval' };

    const migrated = migrateWorkspaceV5(
      { graph: legacy, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'classifier',
          kind: 'step',
          executor: 'ai',
          participation: { internalTools: true },
          position: { x: 230, y: 220 },
        }),
        expect.objectContaining({
          id: 'diagnostic',
          kind: 'step',
          executor: 'deterministic',
          hitl: {
            enabled: true,
            timing: 'before',
            response: {
              type: 'approval',
              allowedOutcomes: [
                { id: 'outcome:diagnostic-end', label: 'End', resumeNodeId: 'end' },
              ],
            },
          },
        }),
        expect.objectContaining({ id: 'refund', kind: 'step', executor: 'tool' }),
        expect.objectContaining({ id: 'human', kind: 'step', executor: 'human' }),
      ]),
    );
  });

  it('normalizes legacy pending proposal node operations during restoration', () => {
    const legacy = legacyV1Graph();
    const proposal = {
      id: 'legacy-proposal',
      operations: [
        {
          type: 'add_node',
          node: {
            id: 'legacy-tool',
            kind: 'tool',
            label: 'Legacy Tool',
            position: { x: 880, y: 220 },
          },
        },
        {
          type: 'update_node',
          nodeId: 'classifier',
          patch: { kind: 'agent', config: { tools: ['search'] } },
        },
      ],
    };

    const migrated = migrateWorkspaceV5(
      { graph: legacy, proposal, scenarios: [] },
      service.createInitial,
    );

    const operations = (migrated.proposal as unknown as { operations: unknown[] }).operations;
    expect(operations).toEqual([
      expect.objectContaining({
        type: 'add_node',
        node: expect.objectContaining({ kind: 'step', executor: 'tool' }),
      }),
      expect.objectContaining({
        type: 'update_node',
        patch: expect.objectContaining({
          executor: 'ai',
          participation: { internalTools: true },
        }),
      }),
    ]);
    expect((operations[1] as { patch: Record<string, unknown> }).patch).not.toHaveProperty('kind');
  });

  it('preserves valid pre-command graph data and supplies its empty subgraph collection', () => {
    const legacy = legacyV1Graph();
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

    const migrated = migrateWorkspaceV5(
      { graph: legacy, proposal, scenarios },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      schemaVersion: '4',
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'classifier', kind: 'step', executor: 'ai' }),
        expect.objectContaining({ id: 'diagnostic', kind: 'step', executor: 'deterministic' }),
        expect.objectContaining({ id: 'refund', kind: 'step', executor: 'tool' }),
        expect.objectContaining({ id: 'human', kind: 'step', executor: 'human' }),
      ]),
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
    const migrated = migrateWorkspaceV5(
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

  it('advances v3 to v4 without changing ordinary topology, policies, or pending proposal meaning', () => {
    const graph = {
      ...structuredClone(sampleGraph),
      schemaVersion: '3' as const,
    } as unknown as WorkflowGraphV3;
    const proposal = createProposal(sampleGraph, {
      operations: [
        {
          type: 'update_node',
          nodeId: 'billing',
          patch: { description: 'Persist this review draft.' },
        },
      ],
      rationale: 'Persist this review draft.',
    }).proposal!;

    const migrated = migrateWorkspaceV5(
      { graph, proposal, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      schemaVersion: '4',
      id: graph.id,
      name: graph.name,
      nodes: graph.nodes,
      edges: graph.edges,
      updatedAt: graph.updatedAt,
    });
    expect(migrated.proposal).toEqual(proposal);
  });

  it('migrates v2 HITL, sensitive policy, and pending proposal data without replacing incomplete drafts', () => {
    const graph = structuredClone(sampleGraph) as unknown as {
      schemaVersion: '2';
      nodes: Array<Record<string, unknown>>;
      edges: typeof sampleGraph.edges;
    };
    graph.schemaVersion = '2';
    const classifier = graph.nodes.find((node) => node.id === 'classifier')!;
    classifier.hitl = {
      enabled: true,
      timing: 'conditional',
      inputType: 'selection',
      condition: 'risk.requiresReview === true',
    };
    classifier.modifiers = { sensitiveSideEffect: true, guardrail: true };
    const proposal = {
      id: 'v2-pending',
      operations: [
        {
          type: 'update_node',
          nodeId: 'classifier',
          patch: {
            hitl: {
              enabled: true,
              timing: 'conditional',
              inputType: 'approval',
              condition: 'proposal.requiresReview === true',
            },
            modifiers: { sensitiveSideEffect: true },
          },
        },
        {
          type: 'add_node',
          node: {
            id: 'proposed-gate',
            kind: 'step',
            executor: 'ai',
            label: 'Proposed gate',
            position: { x: 900, y: 220 },
            hitl: {
              enabled: true,
              timing: 'conditional',
              inputType: 'approval',
              condition: 'proposal.needsApproval === true',
            },
          },
        },
        {
          type: 'add_edge',
          edge: {
            id: 'proposed-gate-end',
            source: 'proposed-gate',
            target: 'end',
            mode: 'normal',
          },
        },
      ],
    };

    const migrated = migrateWorkspaceV5(
      { graph, proposal, scenarios: [] },
      service.createInitial,
    );
    const migratedClassifier = migrated.graph?.nodes.find((node) => node.id === 'classifier');

    expect(migratedClassifier).toMatchObject({
      kind: 'step',
      hitl: {
        enabled: true,
        timing: 'inside',
        activation: { reason: 'risk.requiresReview === true' },
        response: {
          type: 'selection',
          selectionChoices: [
            { id: 'outcome:classifier-billing', label: 'billing' },
            { id: 'outcome:classifier-diagnostic', label: 'technical' },
            { id: 'outcome:classifier-human', label: 'unknown' },
          ],
          allowedOutcomes: [
            { id: 'outcome:classifier-billing', resumeNodeId: 'billing' },
            { id: 'outcome:classifier-diagnostic', resumeNodeId: 'diagnostic' },
            { id: 'outcome:classifier-human', resumeNodeId: 'human' },
          ],
        },
      },
      sensitive: {
        target: 'Legacy sensitive side effect',
        approvalRequired: false,
      },
      modifiers: { guardrail: true },
    });
    expect(migratedClassifier).not.toMatchObject({ modifiers: { sensitiveSideEffect: true } });
    expect(migrated.graph?.schemaVersion).toBe('4');
    const operations = (migrated.proposal as unknown as { operations: Array<{ patch: Record<string, unknown> }> }).operations;
    expect(operations[0]?.patch).toMatchObject({
      hitl: {
        timing: 'inside',
        activation: { reason: 'proposal.requiresReview === true' },
      },
      sensitive: { target: 'Legacy sensitive side effect' },
    });
    expect(operations[0]?.patch.modifiers).toBeUndefined();
    expect((operations[1] as unknown as { node: Record<string, unknown> }).node).toMatchObject({
      hitl: {
        timing: 'inside',
        activation: { reason: 'proposal.needsApproval === true' },
        response: {
          allowedOutcomes: [
            { id: 'outcome:proposed-gate-end', resumeNodeId: 'end' },
          ],
        },
      },
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

    const migrated = migrateWorkspaceV5(
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
