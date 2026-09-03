import { describe, expect, it } from 'vitest';

import { createWorkspaceService } from '@/src/application/workspace';
import {
  createProposal,
  enumerateScenarios,
  researchIntakeRoutingGraph,
  researchSupervisorGraph,
  sampleGraph,
  validateGraph,
  WorkflowGraphV1,
  WorkflowGraphV3,
} from '@/src/domain';
import { migrateWorkspaceV6 } from './migrate-workspace';

const service = createWorkspaceService({
  now: () => '2026-08-28T12:00:00.000Z',
  makeId: (prefix) => `${prefix}-generated`,
});

const legacyV1Graph = (): WorkflowGraphV1 => {
  const graph = structuredClone(sampleGraph);
  const { capabilities, relationships, ...legacyGraph } = graph;
  void capabilities;
  void relationships;
  const legacyKinds: Record<string, string> = {
    classifier: 'agent',
    billing: 'agent',
    diagnostic: 'action',
    human: 'human_input',
    refund: 'tool',
  };

  return {
    ...legacyGraph,
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
  it('preserves only a compact schema-safe human review request', () => {
    const reviewRequest = {
      status: 'changes_requested' as const,
      feedback: '  Add a clearer fallback route.  ',
      proposalId: 'proposal-1',
      proposalCreatedAt: '2026-09-01T09:00:00.000Z',
      reviewedGraphId: sampleGraph.id,
      reviewedGraphUpdatedAt: sampleGraph.updatedAt,
      reviewedAt: '2026-09-01T10:00:00.000Z',
    };
    const migrated = migrateWorkspaceV6(
      { graph: structuredClone(sampleGraph), proposal: null, reviewRequest },
      service.createInitial,
    );
    const malformed = migrateWorkspaceV6(
      {
        graph: structuredClone(sampleGraph),
        proposal: null,
        reviewRequest: { ...reviewRequest, feedback: ' ', candidateGraph: sampleGraph },
      },
      service.createInitial,
    );

    expect(migrated.reviewRequest).toEqual({
      ...reviewRequest,
      feedback: 'Add a clearer fallback route.',
    });
    expect(migrated.reviewRequest).not.toHaveProperty('candidateGraph');
    expect(malformed.reviewRequest).toBeNull();
  });

  it('rehydrates a requested candidate with its complete operations and diff alongside feedback', () => {
    const accepted = service.createInitial().graph;
    const candidate = createProposal(accepted, {
      rationale: 'Clarify the billing specialist.',
      expectedGraphUpdatedAt: accepted.updatedAt,
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } }],
    }).proposal!;
    const reviewRequest = {
      status: 'changes_requested' as const,
      feedback: 'Document the escalation route instead.',
      proposalId: candidate.id,
      proposalCreatedAt: candidate.createdAt,
      reviewedGraphId: accepted.id,
      reviewedGraphUpdatedAt: accepted.updatedAt,
      reviewedAt: '2026-09-01T10:00:00.000Z',
    };

    const migrated = migrateWorkspaceV6(
      { graph: accepted, proposal: candidate, reviewRequest },
      service.createInitial,
    );

    expect(migrated.graph).toEqual(accepted);
    expect(migrated.proposal).toEqual(candidate);
    expect(migrated.reviewRequest).toEqual(reviewRequest);
  });

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

    const migrated = migrateWorkspaceV6(
      { graph: invalid, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      schemaVersion: '6',
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

  it('preserves nested subgraph membership and relative geometry on reload', () => {
    const graph = structuredClone(researchSupervisorGraph);
    graph.subgraphs.push({
      id: 'researcher-workflow',
      label: 'Researcher',
      parentId: 'research-supervisor',
      position: { x: 96, y: 188 },
      dimensions: { width: 540, height: 280 },
      collapsed: true,
    });

    const migrated = migrateWorkspaceV6(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.subgraphs.find(
      (subgraph) => subgraph.id === 'researcher-workflow',
    )).toMatchObject({
      parentId: 'research-supervisor',
      position: { x: 96, y: 188 },
      dimensions: { width: 540, height: 280 },
      collapsed: true,
    });
  });

  it('migrates v4 modifier summaries into explicit v5 capability records without changing topology', () => {
    const legacy = structuredClone(sampleGraph) as unknown as {
      schemaVersion: '4';
      capabilities?: unknown;
      nodes: Array<Record<string, unknown>>;
      edges: typeof sampleGraph.edges;
    };
    legacy.schemaVersion = '4';
    delete legacy.capabilities;
    delete (legacy as { relationships?: unknown }).relationships;
    legacy.nodes.find((node) => node.id === 'classifier')!.modifiers = {
      storeRead: true,
      storeWrite: true,
      retryFallback: true,
    };

    const migrated = migrateWorkspaceV6(
      { graph: legacy, proposal: null, scenarios: [] },
      service.createInitial,
    );
    const classifier = migrated.graph?.nodes.find((node) => node.id === 'classifier');

    expect(migrated.graph).toMatchObject({
      schemaVersion: '6',
      capabilities: { store: { available: true }, runtimeMode: { mode: 'unspecified' } },
      edges: legacy.edges,
    });
    expect(classifier).toMatchObject({
      storeAccess: { read: {}, write: {} },
      retry: { maxAttempts: 2, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
      modifiers: { storeRead: true, storeWrite: true, retryFallback: true },
    });
    expect(validateGraph(migrated.graph!)).toEqual([]);
  });

  it('retains parseable incomplete v5 Store and Retry drafts for ordinary validation', () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected a Step fixture.');
    classifier.storeAccess = { read: { namespace: '', key: '' } };
    classifier.retry = {};

    const migrated = migrateWorkspaceV6(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.nodes.find((node) => node.id === 'classifier')).toMatchObject({
      storeAccess: { read: { namespace: '', key: '' } },
      retry: {},
    });
    expect(validateGraph(migrated.graph!).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'STORE_READ_REQUIRES_AVAILABLE_STORE',
        'STORE_ACCESS_NAMESPACE_REQUIRED',
        'STORE_ACCESS_KEY_REQUIRED',
        'RETRY_MAX_ATTEMPTS_REQUIRED',
        'RETRY_BACKOFF_REQUIRED',
      ]),
    );
  });

  it('falls back only when the saved graph shape cannot be parsed', () => {
    const migrated = migrateWorkspaceV6(
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

    const migrated = migrateWorkspaceV6(
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

    const migrated = migrateWorkspaceV6(
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

    const migrated = migrateWorkspaceV6(
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

    const migrated = migrateWorkspaceV6(
      { graph: legacy, proposal, scenarios },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      id: sampleGraph.id,
      schemaVersion: '6',
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
    expect(scenarios).not.toHaveLength(0);
    expect(migrated.scenarios).toEqual([]);
  });

  it('discards persisted scenario arrays and rederives only from a valid frozen graph', () => {
    const frozenGraph = {
      ...structuredClone(sampleGraph),
      status: 'frozen' as const,
    };
    const canonicalScenarios = enumerateScenarios(frozenGraph);
    const staleScenarios = canonicalScenarios.map((scenario) => ({
      ...scenario,
      expectedTerminalNode: 'stale-terminal',
    }));

    const restoredFrozen = migrateWorkspaceV6(
      { graph: frozenGraph, proposal: null, scenarios: staleScenarios },
      service.createInitial,
    );
    const restoredDraft = migrateWorkspaceV6(
      { graph: structuredClone(sampleGraph), proposal: null, scenarios: staleScenarios },
      service.createInitial,
    );

    expect(restoredFrozen.scenarios).toEqual(canonicalScenarios);
    expect(restoredFrozen.scenarios).not.toEqual(staleScenarios);
    expect(restoredDraft.scenarios).toEqual([]);
  });

  it('keeps a persisted Command graph with a topology-derived loop', () => {
    const migrated = migrateWorkspaceV6(
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

  it('rehydrates active v6 relationships, provenance, opaque boundaries, readiness, and End outcome exactly', () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    const end = graph.nodes.find((node) => node.id === 'end');
    if (!classifier || classifier.kind !== 'step' || !end || end.kind !== 'end') {
      throw new Error('Expected the v6 fixture nodes.');
    }

    const evidence = {
      source: 'runtime/contract-observation.json',
      evidenceClass: 'observed-contract',
      confidence: 'high' as const,
      details: 'Captured from the configured runtime.',
      timestamp: '2026-08-28T12:00:00.000Z',
    };
    graph.capabilities.provenance = {
      evidenceOverlayAvailable: true,
      externalOrchestrationAvailable: true,
    };
    classifier.provenance = { representation: 'runtime-generated', evidence };
    classifier.readiness = { state: 'degraded', detail: 'The fallback provider is warming.' };
    classifier.opaque = {
      factoryLabel: 'SupportClassifierFactory',
      inputPorts: [{ name: 'request', description: 'Inbound support request.' }],
      outputPorts: [{ name: 'classification', description: 'Selected support route.' }],
      runtimeInspection: { available: true, evidence },
    };
    end.outcome = { kind: 'domain-specific', detail: 'Ticket routed to a specialist queue.' };
    graph.relationships = [
      {
        id: 'classifier-spawns-triage',
        kind: 'external-orchestration',
        source: { kind: 'node', nodeId: 'classifier' },
        target: { kind: 'external', externalId: 'triage-runner', label: 'Triage runner' },
        label: 'spawns triage run',
        provenance: { representation: 'external-orchestration', evidence },
      },
      {
        id: 'triage-returns-classifier',
        kind: 'external-orchestration',
        source: { kind: 'external', externalId: 'triage-runner', label: 'Triage runner' },
        target: { kind: 'node', nodeId: 'classifier' },
        label: 'returns triage result',
        provenance: { representation: 'external-orchestration', evidence },
      },
    ];

    const migrated = migrateWorkspaceV6(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      schemaVersion: '6',
      capabilities: { provenance: graph.capabilities.provenance },
      relationships: graph.relationships,
    });
    expect(migrated.graph?.nodes.find((node) => node.id === 'classifier')).toMatchObject({
      provenance: { representation: 'runtime-generated', evidence },
      readiness: classifier.readiness,
      opaque: classifier.opaque,
    });
    expect(migrated.graph?.nodes.find((node) => node.id === 'end')).toMatchObject({
      outcome: end.outcome,
    });
    expect(migrated.graph?.relationships.map((relationship) => [relationship.source, relationship.target])).toEqual(
      graph.relationships.map((relationship) => [relationship.source, relationship.target]),
    );
  });

  it('restores a pending v6 proposal without applying relationship or F3 node operations to the accepted graph', () => {
    const graph = structuredClone(sampleGraph);
    const evidence = {
      source: 'runtime/proposal-observation.json',
      evidenceClass: 'proposed-contract',
      confidence: 'medium' as const,
    };
    const proposal = createProposal(graph, {
      rationale: 'Add the observed external review boundary without changing the accepted draft.',
      operations: [
        {
          type: 'update_graph_capabilities',
          patch: {
            provenance: {
              evidenceOverlayAvailable: true,
              externalOrchestrationAvailable: true,
            },
          },
        },
        {
          type: 'add_relationship',
          relationship: {
            id: 'classifier-review-run',
            kind: 'external-orchestration',
            source: { kind: 'node', nodeId: 'classifier' },
            target: { kind: 'external', externalId: 'review-runner', label: 'Review runner' },
            provenance: { representation: 'external-orchestration', evidence },
          },
        },
        {
          type: 'update_node',
          nodeId: 'classifier',
          patch: {
            opaque: {
              factoryLabel: 'ReviewClassifierFactory',
              inputPorts: [{ name: 'request' }],
              outputPorts: [{ name: 'review' }],
              runtimeInspection: { available: true, evidence },
            },
            readiness: { state: 'degraded', detail: 'Review runner capacity is limited.' },
          },
        },
        {
          type: 'update_node',
          nodeId: 'end',
          patch: { outcome: { kind: 'partial-result', detail: 'Awaiting review-run reconciliation.' } },
        },
      ],
    }).proposal;
    expect(proposal?.status).toBe('pending');

    const migrated = migrateWorkspaceV6(
      { graph, proposal, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.proposal).toMatchObject({
      status: 'pending',
      operations: expect.arrayContaining([
        expect.objectContaining({ type: 'add_relationship' }),
        expect.objectContaining({ type: 'update_node', nodeId: 'classifier' }),
        expect.objectContaining({ type: 'update_node', nodeId: 'end' }),
      ]),
    });
    expect(migrated.graph?.relationships).toEqual([]);
    expect(migrated.graph?.capabilities.provenance.externalOrchestrationAvailable).toBe(false);
    expect(migrated.graph?.nodes.find((node) => node.id === 'classifier')).not.toHaveProperty('opaque');
    expect(migrated.graph?.nodes.find((node) => node.id === 'end')).toMatchObject({
      outcome: { kind: 'completed' },
    });
  });

  it('advances v3 to v6 without changing ordinary topology, policies, or pending proposal meaning', () => {
    const { capabilities, relationships, ...legacyGraph } = structuredClone(sampleGraph);
    void capabilities;
    void relationships;
    const graph = {
      ...legacyGraph,
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

    const migrated = migrateWorkspaceV6(
      { graph, proposal, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph).toMatchObject({
      schemaVersion: '6',
      id: graph.id,
      name: graph.name,
      nodes: graph.nodes,
      edges: graph.edges,
      updatedAt: graph.updatedAt,
    });
    expect(migrated.proposal).toEqual(proposal);
  });

  it('preserves parseable incomplete Send and Merge drafts instead of replacing the canvas', () => {
    const graph = structuredClone(sampleGraph);
    graph.nodes.push({
      id: 'draft-merge',
      kind: 'merge',
      label: 'Draft Merge',
      position: { x: 780, y: 300 },
      merge: {
        reducer: { name: '', aggregateState: '' },
        completion: { mode: 'all' },
        continuation: { mode: 'once' },
        waitingForDynamicInputs: true,
      },
    });
    graph.edges = graph.edges.map((edge) =>
      edge.id === 'classifier-billing'
        ? {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            mode: 'send' as const,
            send: {
              destinationTemplateId: edge.target,
              multiplicity: 'dynamic' as const,
              payloadLabel: '',
              mergeNodeId: '',
            },
          }
        : edge,
    );

    const migrated = migrateWorkspaceV6(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.id).toBe(graph.id);
    expect(migrated.graph?.nodes.find((node) => node.id === 'draft-merge')).toMatchObject({
      kind: 'merge',
      merge: { reducer: { name: '', aggregateState: '' } },
    });
    expect(migrated.graph?.edges.find((edge) => edge.id === 'classifier-billing')).toMatchObject({
      mode: 'send',
      send: { payloadLabel: '', mergeNodeId: '' },
    });
    expect(validateGraph(migrated.graph!).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'SEND_PAYLOAD_LABEL_REQUIRED',
        'SEND_MERGE_REQUIRED',
        'MERGE_REDUCER_REQUIRED',
        'MERGE_AGGREGATE_STATE_REQUIRED',
      ]),
    );
  });

  it('migrates v2 HITL, sensitive policy, and pending proposal data without replacing incomplete drafts', () => {
    const graph = structuredClone(sampleGraph) as unknown as {
      schemaVersion: '2';
      capabilities?: unknown;
      nodes: Array<Record<string, unknown>>;
      edges: typeof sampleGraph.edges;
    };
    graph.schemaVersion = '2';
    delete graph.capabilities;
    delete (graph as { relationships?: unknown }).relationships;
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

    const migrated = migrateWorkspaceV6(
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
    expect(migrated.graph?.schemaVersion).toBe('6');
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

  it('migrates v5 elements to declared v6 records without inventing evidence or relationships', () => {
    const graph = structuredClone(sampleGraph) as unknown as Record<string, unknown>;
    const capabilities = graph.capabilities as Record<string, unknown>;
    const { provenance, ...v5Capabilities } = capabilities;
    void provenance;
    graph.schemaVersion = '5';
    graph.capabilities = v5Capabilities;
    delete graph.relationships;
    const nodes = graph.nodes as Array<Record<string, unknown>>;
    nodes.find((node) => node.id === 'classifier')!.modifiers = { readiness: 'degraded' };
    const end = nodes.find((node) => node.id === 'end')!;
    end.label = 'Awaiting reply';

    const migrated = migrateWorkspaceV6(
      { graph, proposal: null, scenarios: [] },
      service.createInitial,
    );
    const classifier = migrated.graph?.nodes.find((node) => node.id === 'classifier');
    const migratedEnd = migrated.graph?.nodes.find((node) => node.id === 'end');

    expect(migrated.graph).toMatchObject({
      schemaVersion: '6',
      relationships: [],
      capabilities: {
        provenance: {
          evidenceOverlayAvailable: true,
          externalOrchestrationAvailable: false,
        },
      },
    });
    expect(classifier).toMatchObject({
      provenance: { representation: 'declared' },
      readiness: { state: 'degraded' },
    });
    expect(classifier?.provenance?.evidence).toBeUndefined();
    expect(migratedEnd).toMatchObject({ outcome: { kind: 'awaiting-reply' } });
    expect(migrated.graph?.edges[0]).toMatchObject({ provenance: { representation: 'declared' } });
    expect(migrated.graph?.edges[0].provenance?.evidence).toBeUndefined();
  });

  it('backfills a pending v5 proposal diff without applying its operations to the accepted graph', () => {
    const graph = structuredClone(sampleGraph) as unknown as Record<string, unknown>;
    const capabilities = graph.capabilities as Record<string, unknown>;
    const { provenance, ...v5Capabilities } = capabilities;
    void provenance;
    graph.schemaVersion = '5';
    graph.capabilities = v5Capabilities;
    delete graph.relationships;
    const nodes = graph.nodes as Array<Record<string, unknown>>;
    const acceptedClassifierLabel = nodes.find((node) => node.id === 'classifier')!.label;
    const operations = [
      {
        type: 'update_node',
        nodeId: 'classifier',
        patch: { label: 'Pending proposal label' },
      },
    ];
    const oldDiff = {
      addedNodeIds: [],
      updatedNodeIds: ['classifier'],
      removedNodeIds: [],
      addedSubgraphIds: [],
      updatedSubgraphIds: [],
      removedSubgraphIds: [],
      membershipChangedNodeIds: [],
      addedEdgeIds: [],
      updatedEdgeIds: [],
      removedEdgeIds: [],
      changedCapabilityPaths: [],
    };

    const migrated = migrateWorkspaceV6(
      {
        graph,
        proposal: {
          id: 'pending-v5-proposal',
          baseGraphId: sampleGraph.id,
          baseUpdatedAt: sampleGraph.updatedAt,
          operations,
          rationale: 'Keep the update under review.',
          status: 'pending',
          createdAt: '2026-08-28T12:00:00.000Z',
          diff: oldDiff,
        },
        scenarios: [],
      },
      service.createInitial,
    );

    expect(migrated.proposal).toMatchObject({
      id: 'pending-v5-proposal',
      status: 'pending',
      operations,
      diff: {
        ...oldDiff,
        addedRelationshipIds: [],
        updatedRelationshipIds: [],
        removedRelationshipIds: [],
        changedProvenancePaths: [],
        changedReadinessNodeIds: [],
        changedOpaqueNodeIds: [],
        changedEndOutcomeNodeIds: [],
      },
    });
    expect(migrated.graph?.nodes.find((node) => node.id === 'classifier')?.label).toBe(
      acceptedClassifierLabel,
    );
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

    const migrated = migrateWorkspaceV6(
      { graph: legacy, proposal: null, scenarios: [] },
      service.createInitial,
    );

    expect(migrated.graph?.edges.find((edge) => edge.id === 'researcher-continue')).toMatchObject({
      id: 'researcher-continue',
      source: 'researcher',
      target: 'research-supervisor',
      mode: 'normal',
      label: 'continue',
    });
    expect(migrated.graph?.edges.find((edge) => edge.id === 'supervisor-human-review')).toMatchObject({
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
