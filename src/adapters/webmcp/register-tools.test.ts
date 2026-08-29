import { describe, expect, it } from 'vitest';

import { createProposal, sampleGraph } from '@/src/domain';
import { createWorkspaceService } from '@/src/application/workspace';
import { registerWebMcpTools } from './register-tools';

type RegisteredTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
};

type JsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  const?: string | boolean;
  enum?: string[];
  minLength?: number;
  additionalProperties?: boolean;
  description?: string;
};

describe('WebMCP adapter', () => {
  it('returns structured objects for graph reads, proposals, and scenario errors', async () => {
    const registered = new Map<string, RegisteredTool>();
    const proposalResponse = {
      ok: false as const,
      error: { code: 'TEST_PROPOSAL', message: 'Proposal stub response.' },
    };
    const modelContext = {
      registerTool: async (tool: RegisteredTool) => {
        registered.set(tool.name, tool);
      },
    };
    const pendingProposal = createProposal(sampleGraph, {
      rationale: 'Clarify the billing specialist.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    }).proposal!;

    await registerWebMcpTools(
      modelContext as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => ({
          graph: structuredClone(sampleGraph),
          proposal: pendingProposal,
          scenarios: [],
        }),
        submitProposal: () => proposalResponse,
      },
      new AbortController().signal,
    );

    const graphResult = await registered.get('get_graph')!.execute({});
    const proposalResult = await registered.get('propose_graph_changes')!.execute({});
    const scenarioResult = await registered.get('get_branch_scenarios')!.execute({});

    expect(typeof graphResult).toBe('object');
    expect(graphResult).toMatchObject({
      ok: true,
      graph: { id: sampleGraph.id },
      pendingProposal: {
        id: pendingProposal.id,
        status: 'pending',
        rationale: pendingProposal.rationale,
        createdAt: pendingProposal.createdAt,
      },
    });
    expect(proposalResult).toEqual(proposalResponse);
    expect(scenarioResult).toEqual({
      ok: false,
      error: { code: 'GRAPH_NOT_FROZEN', message: 'The human has not frozen the graph.' },
    });

    expect([...registered.keys()]).toEqual([
      'get_graph',
      'propose_graph_changes',
      'get_branch_scenarios',
    ]);
    const proposalTool = registered.get('propose_graph_changes')!;
    const proposalSchema = proposalTool.inputSchema as JsonSchema & {
      properties?: Record<string, JsonSchema & { items?: JsonSchema }>;
    };
    const variants = proposalSchema.properties?.operations?.items?.oneOf ?? [];
    const operationTypes = variants.map((variant) => variant.properties?.type?.const);
    const addNode = variants.find((variant) => variant.properties?.type?.const === 'add_node');
    const updateNode = variants.find((variant) => variant.properties?.type?.const === 'update_node');
    const addEdge = variants.find((variant) => variant.properties?.type?.const === 'add_edge');
    const updateEdge = variants.find((variant) => variant.properties?.type?.const === 'update_edge');
    const edgeModes = (properties?: Record<string, JsonSchema>) => properties?.mode?.enum;
    const addNodeVariants = addNode?.properties?.node?.oneOf ?? [];
    const nodeKind = (variant: JsonSchema) => variant.properties?.kind?.const;
    const startNode = addNodeVariants.find((variant) => nodeKind(variant) === 'start');
    const stepNode = addNodeVariants.find((variant) => nodeKind(variant) === 'step');
    const endNode = addNodeVariants.find((variant) => nodeKind(variant) === 'end');
    const stepOnlyProperties = ['executor', 'participation', 'hitl', 'sensitive', 'modifiers'];

    expect(proposalSchema.required).toEqual(['operations', 'rationale']);
    expect(operationTypes).toEqual(expect.arrayContaining([
      'add_subgraph',
      'update_subgraph',
      'assign_nodes_to_subgraph',
      'remove_nodes_from_subgraph',
      'dissolve_subgraph',
    ]));
    expect(addNodeVariants).toHaveLength(3);
    expect([nodeKind(startNode!), nodeKind(stepNode!), nodeKind(endNode!)]).toEqual([
      'start',
      'step',
      'end',
    ]);
    expect(stepNode?.required).toEqual(['id', 'kind', 'label', 'position', 'executor']);
    expect(stepNode?.properties).toMatchObject({
      executor: { enum: ['deterministic', 'ai', 'tool', 'human'] },
      participation: { properties: { internalTools: { const: true } } },
      modifiers: {
        properties: {
          guardrail: { const: true },
          storeRead: { const: true },
          storeWrite: { const: true },
          retryFallback: { const: true },
          opaque: { const: true },
          readiness: { enum: ['degraded', 'unimplemented'] },
        },
      },
    });
    expect(stepNode?.properties?.hitl?.properties).toMatchObject({
      enabled: { type: 'boolean' },
      timing: { enum: ['before', 'inside', 'after'] },
      response: {
        required: ['type', 'allowedOutcomes'],
        properties: {
          type: { enum: ['approval', 'text', 'selection'] },
          selectionChoices: {
            items: { required: ['id', 'label'] },
          },
          allowedOutcomes: {
            items: { required: ['id', 'label', 'resumeNodeId'] },
          },
        },
      },
      activation: { properties: { reason: { type: 'string' } } },
    });
    expect(stepNode?.properties?.sensitive).toMatchObject({
      required: ['target', 'authorization', 'approvalRequired', 'idempotency'],
      properties: {
        target: { type: 'string', minLength: 1 },
        authorization: { type: 'string', minLength: 1 },
        approvalRequired: { type: 'boolean' },
        idempotency: { type: 'string', minLength: 1 },
      },
    });
    for (const property of stepOnlyProperties) {
      expect(startNode?.properties).not.toHaveProperty(property);
      expect(endNode?.properties).not.toHaveProperty(property);
    }
    expect(updateNode?.properties?.patch?.properties).toMatchObject({
      executor: { enum: ['deterministic', 'ai', 'tool', 'human'] },
      participation: { properties: { internalTools: { const: true } } },
      hitl: expect.any(Object),
      sensitive: {
        anyOf: [expect.any(Object), { type: 'null' }],
      },
      modifiers: expect.any(Object),
    });
    expect(updateNode?.properties?.patch?.description).toContain('Step-only');
    expect(proposalTool.description).toContain('Start, Step, or End');
    expect(proposalTool.description).toContain('requires an executor');
    expect(proposalTool.description).toContain('before/inside/after');
    expect(proposalTool.description).toContain('respond, resume, freeze');
    expect(addEdge?.properties?.edge?.properties).toMatchObject({
      source: { type: 'string' },
      target: { type: 'string' },
    });
    expect(updateEdge?.properties?.patch?.properties).toMatchObject({
      source: { type: 'string' },
      target: { type: 'string' },
    });
    expect(edgeModes(addEdge?.properties?.edge?.properties)).toEqual([
      'normal',
      'conditional',
      'command',
      'fallback',
    ]);
    expect(edgeModes(updateEdge?.properties?.patch?.properties)).toEqual([
      'normal',
      'conditional',
      'command',
      'fallback',
    ]);
  });

  it('submits complete v3 HITL and sensitive configuration only as a pending human review', async () => {
    const registered = new Map<string, RegisteredTool>();
    const service = createWorkspaceService({
      now: () => '2026-08-30T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-generated`,
    });
    let state = service.createInitial();
    const before = structuredClone(state.graph);

    await registerWebMcpTools(
      {
        registerTool: async (tool: RegisteredTool) => {
          registered.set(tool.name, tool);
        },
      } as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => state,
        submitProposal: (input) => {
          const transition = service.submitProposal(state, input);
          state = transition.state;
          return transition.result!;
        },
      },
      new AbortController().signal,
    );

    const response = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Configure the classifier gate before external review.',
      expectedGraphUpdatedAt: before.updatedAt,
      operations: [
        {
          type: 'update_node',
          nodeId: 'classifier',
          patch: {
            hitl: {
              enabled: true,
              timing: 'inside',
              activation: { reason: 'Escalated support classification' },
              response: {
                type: 'selection',
                selectionChoices: [
                  { id: 'billing', label: 'Billing' },
                  { id: 'technical', label: 'Technical' },
                  { id: 'unknown', label: 'Escalate to human' },
                ],
                allowedOutcomes: [
                  { id: 'billing', label: 'Route to billing', resumeNodeId: 'billing' },
                  { id: 'technical', label: 'Route to diagnostics', resumeNodeId: 'diagnostic' },
                  { id: 'unknown', label: 'Escalate', resumeNodeId: 'human' },
                ],
              },
            },
            sensitive: {
              target: 'Support classification record',
              authorization: 'Support lead',
              approvalRequired: false,
              idempotency: 'Classification revision identifier',
            },
          },
        },
      ],
    });

    expect(response).toMatchObject({ ok: true, proposal: { status: 'pending' } });
    expect(state.proposal?.status).toBe('pending');
    expect(state.graph).toEqual(before);
    expect(state.graph.nodes.find((node) => node.id === 'classifier')).not.toHaveProperty('hitl');
    expect([...registered.keys()]).toHaveLength(3);
  });

  it('keeps invalid approval-required sensitive proposals out of accepted state', async () => {
    const registered = new Map<string, RegisteredTool>();
    const service = createWorkspaceService({
      now: () => '2026-08-30T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-generated`,
    });
    let state = service.createInitial();
    const before = structuredClone(state.graph);

    await registerWebMcpTools(
      { registerTool: async (tool: RegisteredTool) => { registered.set(tool.name, tool); } } as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => state,
        submitProposal: (input) => {
          const transition = service.submitProposal(state, input);
          state = transition.state;
          return transition.result!;
        },
      },
      new AbortController().signal,
    );

    const response = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Try to require approval without configuring a gate.',
      operations: [{
        type: 'update_node',
        nodeId: 'refund',
        patch: {
          sensitive: {
            target: 'Customer refund',
            authorization: 'Payments administrator',
            approvalRequired: true,
            idempotency: 'Provider idempotency key',
          },
        },
      }],
    });

    expect(response).toMatchObject({
      ok: true,
      proposal: {
        status: 'invalid',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({ code: 'SENSITIVE_APPROVAL_GATE_REQUIRED' }),
        ]),
      },
    });
    expect(state.graph).toEqual(before);
    expect(state.graph.nodes.find((node) => node.id === 'refund')).not.toHaveProperty('hitl');
  });

  it('cannot bypass frozen or pending proposal authority through WebMCP', async () => {
    const registered = new Map<string, RegisteredTool>();
    const service = createWorkspaceService({
      now: () => '2026-08-30T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-generated`,
    });
    let state = service.freezeGraph(service.createInitial()).state;
    const frozenBefore = structuredClone(state.graph);

    await registerWebMcpTools(
      { registerTool: async (tool: RegisteredTool) => { registered.set(tool.name, tool); } } as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => state,
        submitProposal: (input) => {
          const transition = service.submitProposal(state, input);
          state = transition.state;
          return transition.result!;
        },
      },
      new AbortController().signal,
    );

    const frozenResponse = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Attempt a frozen graph edit.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Frozen change' } }],
    });
    expect(frozenResponse).toEqual({
      ok: false,
      error: { code: 'GRAPH_FROZEN', message: 'Unfreeze the graph before requesting changes.' },
    });
    expect(state.graph).toEqual(frozenBefore);

    state = service.createInitial();
    const first = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Await human review.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } }],
    });
    const pendingBefore = structuredClone(state.graph);
    const pendingResponse = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Attempt to supersede the pending proposal.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Bypass review' } }],
    });

    expect(first).toMatchObject({ ok: true, proposal: { status: 'pending' } });
    expect(pendingResponse).toEqual({
      ok: false,
      error: {
        code: 'PENDING_PROPOSAL_EXISTS',
        message: 'Review the current proposal before submitting another one.',
      },
    });
    expect(state.graph).toEqual(pendingBefore);
    expect([...registered.keys()]).toEqual([
      'get_graph',
      'propose_graph_changes',
      'get_branch_scenarios',
    ]);
  });

  it('returns an invalid self or duplicate proposal without changing the accepted graph', async () => {
    const registered = new Map<string, RegisteredTool>();
    const service = createWorkspaceService({
      now: () => '2026-08-30T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-generated`,
    });
    let state = service.createInitial();
    const before = structuredClone(state.graph);

    await registerWebMcpTools(
      {
        registerTool: async (tool: RegisteredTool) => {
          registered.set(tool.name, tool);
        },
      } as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => state,
        submitProposal: (input) => {
          const transition = service.submitProposal(state, input);
          state = transition.state;
          return transition.result!;
        },
      },
      new AbortController().signal,
    );

    const response = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Try invalid canonical connections.',
      operations: [
        {
          type: 'add_edge',
          edge: {
            id: 'classifier-self',
            source: 'classifier',
            target: 'classifier',
            mode: 'conditional',
            label: 'retry',
          },
        },
        {
          type: 'add_edge',
          edge: {
            id: 'start-classifier-duplicate',
            source: 'start',
            target: 'classifier',
            mode: 'normal',
          },
        },
      ],
    });

    expect(response).toMatchObject({
      ok: true,
      proposal: {
        status: 'invalid',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({ code: 'SELF_CONNECTION' }),
          expect.objectContaining({ code: 'DUPLICATE_CONNECTION' }),
        ]),
      },
    });
    expect(state.graph).toEqual(before);
    expect([...registered.keys()]).toHaveLength(3);
  });

  it('keeps Step-only updates to a Start node invalid and out of accepted state', async () => {
    const registered = new Map<string, RegisteredTool>();
    const service = createWorkspaceService({
      now: () => '2026-08-30T12:00:00.000Z',
      makeId: (prefix) => `${prefix}-generated`,
    });
    let state = service.createInitial();
    const before = structuredClone(state.graph);

    await registerWebMcpTools(
      {
        registerTool: async (tool: RegisteredTool) => {
          registered.set(tool.name, tool);
        },
      } as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => state,
        submitProposal: (input) => {
          const transition = service.submitProposal(state, input);
          state = transition.state;
          return transition.result!;
        },
      },
      new AbortController().signal,
    );

    const response = await registered.get('propose_graph_changes')!.execute({
      rationale: 'Try to apply Step semantics to structural nodes.',
      operations: [
        {
          type: 'update_node',
          nodeId: 'start',
          patch: {
            executor: 'ai',
            participation: { internalTools: true },
            modifiers: { guardrail: true, readiness: 'degraded' },
          },
        },
      ],
    });

    expect(response).toMatchObject({
      ok: true,
      proposal: {
        status: 'invalid',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({ code: 'STEP_FIELDS_REQUIRE_STEP' }),
        ]),
      },
    });
    expect(state.graph).toEqual(before);
    expect(state.graph.nodes.find((node) => node.id === 'start')).not.toHaveProperty('executor');
    expect([...registered.keys()]).toEqual([
      'get_graph',
      'propose_graph_changes',
      'get_branch_scenarios',
    ]);
  });
});
