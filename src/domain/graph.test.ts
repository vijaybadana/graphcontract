import { describe, expect, it } from 'vitest';

import {
  applyGraphOperations,
  enumerateScenarios,
  graphOperationSchema,
  graphNodePatchSchema,
  researchIntakeRoutingGraph,
  sampleGraph,
  validateGraph,
  workflowGraphSchema,
} from './graph';
import {
  buildGraphContractDownload,
  buildGraphScenariosDownload,
  buildPythonTestsDownload,
} from '../adapters/exports/downloads';

describe('routing edge semantics', () => {
  it('models executor ownership separately from internal tools, HITL, and modifier summaries', () => {
    const graph = structuredClone(sampleGraph);
    const ai = graph.nodes.find((node) => node.id === 'classifier');
    const human = graph.nodes.find((node) => node.id === 'human');
    const tool = graph.nodes.find((node) => node.id === 'refund');

    if (ai?.kind !== 'step' || human?.kind !== 'step' || tool?.kind !== 'step') {
      throw new Error('The canonical fixture must contain normalized Steps.');
    }

    ai.participation = { internalTools: true };
    ai.hitl = {
      enabled: true,
      timing: 'before',
      response: {
        type: 'approval',
        allowedOutcomes: [
          { id: 'approve', label: 'Approve billing', resumeNodeId: 'billing' },
          { id: 'request-changes', label: 'Request changes', resumeNodeId: 'diagnostic' },
          { id: 'reject', label: 'Reject', resumeNodeId: 'human' },
        ],
      },
    };
    ai.sensitive = {
      target: 'Refund decision',
      authorization: 'Billing operator',
      approvalRequired: false,
      idempotency: 'No external mutation',
    };
    ai.modifiers = {
      guardrail: true,
      storeRead: true,
      storeWrite: true,
      retryFallback: true,
      opaque: true,
      readiness: 'degraded',
    };

    expect(workflowGraphSchema.safeParse(graph).success).toBe(true);
    expect(validateGraph(graph)).toEqual([]);
    expect(ai).toMatchObject({
      kind: 'step',
      executor: 'ai',
      participation: { internalTools: true },
      hitl: { enabled: true, timing: 'before' },
      sensitive: { target: 'Refund decision', approvalRequired: false },
      modifiers: { storeRead: true, storeWrite: true, readiness: 'degraded' },
    });
    expect(human.executor).toBe('human');
    expect(human.hitl).toBeUndefined();
    expect(tool.executor).toBe('tool');

    const legacyKind = structuredClone(graph) as unknown as {
      nodes: Array<Record<string, unknown>>;
    };
    legacyKind.nodes.find((node) => node.id === 'classifier')!.kind = 'agent';
    expect(workflowGraphSchema.safeParse(legacyKind).success).toBe(false);

    const duplicateSensitiveTruth = structuredClone(graph) as unknown as {
      nodes: Array<Record<string, unknown>>;
    };
    duplicateSensitiveTruth.nodes.find((node) => node.id === 'classifier')!.modifiers = {
      sensitiveSideEffect: true,
    };
    expect(workflowGraphSchema.safeParse(duplicateSensitiveTruth).success).toBe(false);
  });

  it('validates complete HITL response contracts and explicit sensitive approval gates', () => {
    const invalid = structuredClone(sampleGraph);
    const classifier = invalid.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected a Step fixture.');

    classifier.hitl = {
      enabled: true,
      timing: 'inside',
      response: {
        type: 'selection',
        selectionChoices: [
          { id: 'billing', label: 'Billing' },
          { id: 'billing', label: 'Duplicate billing' },
        ],
        allowedOutcomes: [
          { id: 'route', label: 'Route', resumeNodeId: 'missing-node' },
          { id: 'route', label: 'Duplicate route', resumeNodeId: 'billing' },
        ],
      },
    };
    classifier.sensitive = {
      target: 'Refund',
      authorization: 'Billing operator',
      approvalRequired: true,
      idempotency: 'Refund idempotency key',
    };

    expect(validateGraph(invalid).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'HITL_OUTCOME_ID_DUPLICATE',
        'HITL_OUTCOME_DESTINATION_INVALID',
        'HITL_SELECTION_CHOICE_ID_DUPLICATE',
        'SENSITIVE_APPROVAL_GATE_REQUIRED',
      ]),
    );
    expect(classifier.hitl.timing).toBe('inside');
    expect(classifier.hitl.response?.allowedOutcomes[0]?.resumeNodeId).toBe('missing-node');
  });

  it('requires a configured before approval gate for approval-required sensitive policy without adding one', () => {
    const graph = structuredClone(sampleGraph);
    const refund = graph.nodes.find((node) => node.id === 'refund');
    if (!refund || refund.kind !== 'step') throw new Error('Expected a Step fixture.');
    refund.sensitive = {
      target: 'Customer refund',
      authorization: 'Payments administrator',
      approvalRequired: true,
      idempotency: 'Provider idempotency key',
    };

    expect(validateGraph(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SENSITIVE_APPROVAL_GATE_REQUIRED', path: 'nodes.refund.sensitive.approvalRequired' }),
      ]),
    );
    expect(refund.hitl).toBeUndefined();
  });

  it('normalizes route fields on canonical add and update operations', () => {
    const normal = applyGraphOperations(researchIntakeRoutingGraph, [
      {
        type: 'update_edge',
        edgeId: 'researcher-continue',
        patch: { condition: 'state.shouldContinue === true', label: ' continue ' },
      },
    ]).graph.edges.find((edge) => edge.id === 'researcher-continue');
    expect(normal).toEqual({
      id: 'researcher-continue',
      source: 'researcher',
      target: 'research-supervisor',
      mode: 'normal',
      label: 'continue',
    });

    const fallback = applyGraphOperations(researchIntakeRoutingGraph, [
      {
        type: 'update_edge',
        edgeId: 'supervisor-human-review',
        patch: { label: 'otherwise', condition: 'state.unhandled === true' },
      },
    ]).graph.edges.find((edge) => edge.id === 'supervisor-human-review');
    expect(fallback).toEqual({
      id: 'supervisor-human-review',
      source: 'research-supervisor',
      target: 'human-review',
      mode: 'fallback',
      label: 'fallback',
    });

    const command = applyGraphOperations(researchIntakeRoutingGraph, [
      {
        type: 'update_edge',
        edgeId: 'clarify-write-brief',
        patch: { label: ' ready ', condition: ' state.ready === true ' },
      },
    ]).graph.edges.find((edge) => edge.id === 'clarify-write-brief');
    expect(command).toMatchObject({
      mode: 'command',
      label: 'ready',
      condition: 'state.ready === true',
    });
  });

  it('rejects kind changes and Step-only patches on structural nodes without mutating them', () => {
    expect(graphNodePatchSchema.safeParse({ kind: 'step' }).success).toBe(false);

    const original = structuredClone(sampleGraph);
    const applied = applyGraphOperations(original, [
      {
        type: 'update_node',
        nodeId: 'start',
        patch: {
          sensitive: {
            target: 'Structural mutation',
            authorization: 'Nobody',
            approvalRequired: false,
            idempotency: 'Not applicable',
          },
        },
      },
    ]);

    expect(applied.errors).toEqual([
      expect.objectContaining({ code: 'STEP_FIELDS_REQUIRE_STEP', path: 'operations.0' }),
    ]);
    expect(applied.graph).toEqual(original);
  });

  it('uses null as an operation-only request to remove an existing sensitive policy', () => {
    const original = structuredClone(sampleGraph);
    const classifier = original.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected a Step fixture.');
    classifier.sensitive = {
      target: 'Customer refund',
      authorization: 'Payments administrator',
      approvalRequired: false,
      idempotency: 'Provider idempotency key',
    };

    const operation = {
      type: 'update_node' as const,
      nodeId: 'classifier',
      patch: { sensitive: null },
    };
    expect(graphOperationSchema.safeParse(operation).success).toBe(true);

    const applied = applyGraphOperations(original, [operation]);
    expect(applied.errors).toEqual([]);
    expect(applied.graph.nodes.find((node) => node.id === 'classifier')).not.toHaveProperty('sensitive');
    const roundTripped = workflowGraphSchema.parse(JSON.parse(JSON.stringify(applied.graph)));
    expect(roundTripped.nodes.find((node) => node.id === 'classifier')).not.toHaveProperty('sensitive');
  });

  it('keeps the Research Intake topology valid with commands and a derived return loop', () => {
    expect(validateGraph(researchIntakeRoutingGraph)).toEqual([]);

    expect(researchIntakeRoutingGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'command', label: 'ready' }),
        expect.objectContaining({ mode: 'command', label: 'needs clarification' }),
        expect.objectContaining({ mode: 'conditional', label: 'enough evidence' }),
        expect.objectContaining({ mode: 'fallback', label: 'fallback' }),
        expect.objectContaining({
          id: 'researcher-continue',
          source: 'researcher',
          target: 'research-supervisor',
          mode: 'normal',
        }),
      ]),
    );

    const persistedLoopMode = structuredClone(researchIntakeRoutingGraph) as {
      edges: Array<Record<string, unknown>>;
    };
    persistedLoopMode.edges.find((edge) => edge.id === 'researcher-continue')!.mode = 'loop';
    expect(workflowGraphSchema.safeParse(persistedLoopMode).success).toBe(false);
  });

  it('rejects unreadable conditional and command routes while preserving one fallback', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '   ';
    invalid.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = '   ';
    invalid.edges.find((edge) => edge.id === 'clarify-await-reply')!.condition = '   ';
    invalid.edges.push({
      id: 'supervisor-extra-fallback',
      source: 'research-supervisor',
      target: 'awaiting-user-reply',
      mode: 'fallback',
      label: 'fallback',
    });

    expect(validateGraph(invalid).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'CONDITIONAL_LABEL_REQUIRED',
        'COMMAND_LABEL_REQUIRED',
        'COMMAND_CONDITION_REQUIRED',
        'MULTIPLE_FALLBACKS',
      ]),
    );
  });

  it('rejects self and duplicate connections and gives routing issues stable edge or source paths', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'supervisor-researcher')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'brief-supervisor')!.mode = 'conditional';
    invalid.edges.find((edge) => edge.id === 'researcher-continue')!.mode = 'fallback';
    invalid.edges.push(
      {
        id: 'final-report-extra-normal',
        source: 'final-report',
        target: 'awaiting-user-reply',
        mode: 'normal',
      },
      {
        id: 'researcher-extra-fallback',
        source: 'researcher',
        target: 'final-report',
        mode: 'fallback',
      },
      {
        id: 'clarify-self',
        source: 'clarify-request',
        target: 'clarify-request',
        mode: 'command',
        label: 'retry',
      },
      {
        id: 'research-intake-start-clarify-duplicate',
        source: 'research-intake-start',
        target: 'clarify-request',
        mode: 'normal',
      },
      {
        id: 'clarify-start',
        source: 'clarify-request',
        target: 'research-intake-start',
        mode: 'command',
        label: 'restart',
      },
    );

    const issues = validateGraph(invalid);
    const pathsFor = (code: string) => issues.filter((entry) => entry.code === code).map((entry) => entry.path);

    expect(pathsFor('SELF_CONNECTION')).toEqual(['edges.clarify-self']);
    expect(pathsFor('DUPLICATE_CONNECTION')).toEqual([
      'edges.research-intake-start-clarify',
      'edges.research-intake-start-clarify-duplicate',
    ]);
    expect(pathsFor('START_HAS_INCOMING')).toEqual(['edges.clarify-start']);
    expect(pathsFor('MULTIPLE_NORMAL_EDGES')).toEqual(['nodes.research-intake-start', 'nodes.final-report']);
    expect(pathsFor('CONDITIONAL_EDGE_COUNT')).toEqual(['nodes.write-research-brief']);
    expect(pathsFor('MULTIPLE_FALLBACKS')).toEqual(['nodes.researcher']);
    expect(pathsFor('FALLBACK_WITHOUT_CONDITIONS')).toEqual(['nodes.researcher']);
    expect(pathsFor('CONDITIONAL_LABEL_REQUIRED')).toEqual([
      'nodes.write-research-brief',
      'nodes.research-supervisor',
    ]);
    expect(pathsFor('DUPLICATE_CONDITIONAL_LABEL')).toEqual(['nodes.research-supervisor']);
    expect(pathsFor('COMMAND_LABEL_REQUIRED')).toEqual(['nodes.clarify-request']);
  });

  it('enumerates a derived loop once per path and preserves routing data in exports', () => {
    const scenarios = enumerateScenarios(researchIntakeRoutingGraph);

    expect(scenarios).toEqual(enumerateScenarios(researchIntakeRoutingGraph));
    expect(scenarios).toHaveLength(5);

    const loopScenario = scenarios.find((scenario) =>
      scenario.traversedEdges.some((edge) => edge.id === 'researcher-continue'),
    );
    expect(loopScenario).toMatchObject({
      orderedPath: [
        'research-intake-start',
        'clarify-request',
        'write-research-brief',
        'research-supervisor',
        'researcher',
        'research-supervisor',
        'final-report',
        'report-complete',
      ],
      expectedTerminalNode: 'report-complete',
      traversedEdges: expect.arrayContaining([
        expect.objectContaining({
          id: 'researcher-continue',
          mode: 'normal',
          label: 'continue',
          isLoop: true,
        }),
        expect.objectContaining({
          id: 'supervisor-final-report',
          mode: 'conditional',
          label: 'enough evidence',
          condition: 'evidence.isSufficient === true',
        }),
      ]),
    });
    expect(loopScenario?.traversedEdges.filter((edge) => edge.isLoop)).toHaveLength(1);
    expect(loopScenario?.triggeringConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'clarify-write-brief',
          mode: 'command',
          label: 'ready',
          condition: 'state.ready === true',
        }),
        expect.objectContaining({
          edgeId: 'supervisor-final-report',
          mode: 'conditional',
          label: 'enough evidence',
          condition: 'evidence.isSufficient === true',
        }),
      ]),
    );

    const fallbackScenario = scenarios.find((scenario) =>
      scenario.traversedEdges.some((edge) => edge.mode === 'fallback'),
    );
    expect(fallbackScenario?.traversedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'fallback',
          label: 'fallback',
          isFallback: true,
        }),
      ]),
    );

    const staleExport = structuredClone(researchIntakeRoutingGraph);
    staleExport.edges.find((edge) => edge.id === 'researcher-continue')!.condition =
      'state.shouldContinue === true';
    staleExport.edges.find((edge) => edge.id === 'supervisor-human-review')!.label = 'otherwise';
    staleExport.edges.find((edge) => edge.id === 'supervisor-human-review')!.condition =
      'state.unhandled === true';
    expect(JSON.parse(buildGraphContractDownload(staleExport).content).edges).toEqual(
      researchIntakeRoutingGraph.edges,
    );
    expect(JSON.parse(buildGraphScenariosDownload(researchIntakeRoutingGraph, scenarios).content).scenarios).toEqual(
      scenarios,
    );
  });

  it('enumerates configured human outcomes in stable order through only their canonical outgoing edges', () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected a Step fixture.');
    classifier.hitl = {
      enabled: true,
      timing: 'before',
      response: {
        type: 'approval',
        allowedOutcomes: [
          { id: 'request-changes', label: 'Request changes', resumeNodeId: 'diagnostic' },
          { id: 'approve', label: 'Approve', resumeNodeId: 'billing' },
          { id: 'reject', label: 'Reject', resumeNodeId: 'human' },
        ],
      },
    };

    const scenarios = enumerateScenarios(graph);
    expect(scenarios).toEqual(enumerateScenarios(graph));
    expect(scenarios.map((scenario) => scenario.humanOutcomes[0]?.outcomeId)).toEqual([
      'approve',
      'reject',
      'request-changes',
    ]);
    expect(scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderedPath: ['start', 'classifier', 'billing', 'refund', 'end'],
          humanOutcomes: [
            expect.objectContaining({
              outcomeId: 'approve',
              responseType: 'approval',
              resumeNodeId: 'billing',
            }),
          ],
        }),
      ]),
    );
    expect(JSON.parse(buildGraphScenariosDownload(graph, scenarios).content).scenarios).toEqual(scenarios);
    expect(JSON.parse(buildGraphContractDownload(graph).content).nodes.find((node: { id: string }) => node.id === 'classifier')).toMatchObject({
      hitl: classifier.hitl,
    });
    expect(buildPythonTestsDownload(graph, scenarios).content).toContain('"human_outcomes"');
  });
});
