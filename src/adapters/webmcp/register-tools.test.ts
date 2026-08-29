import { describe, expect, it } from 'vitest';

import { createProposal, sampleGraph } from '@/src/domain';
import { createWorkspaceService } from '@/src/application/workspace';
import { registerWebMcpTools } from './register-tools';

type RegisteredTool = {
  name: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
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
    const proposalSchema = registered.get('propose_graph_changes')!.inputSchema as {
      required?: string[];
      properties?: {
        operations?: {
          items?: {
            oneOf?: Array<{
              properties?: {
                type?: { const?: string };
                node?: { properties?: Record<string, unknown> };
                edge?: { properties?: Record<string, unknown> };
                patch?: { properties?: Record<string, unknown> };
              };
            }>;
          };
        };
      };
    };
    const variants = proposalSchema.properties?.operations?.items?.oneOf ?? [];
    const operationTypes = variants.map((variant) => variant.properties?.type?.const);
    const addNode = variants.find((variant) => variant.properties?.type?.const === 'add_node');
    const addEdge = variants.find((variant) => variant.properties?.type?.const === 'add_edge');
    const updateEdge = variants.find((variant) => variant.properties?.type?.const === 'update_edge');
    const edgeModes = (properties?: Record<string, unknown>) =>
      (properties?.mode as { enum?: string[] } | undefined)?.enum;

    expect(proposalSchema.required).toEqual(['operations', 'rationale']);
    expect(operationTypes).toEqual(expect.arrayContaining([
      'add_subgraph',
      'update_subgraph',
      'assign_nodes_to_subgraph',
      'remove_nodes_from_subgraph',
      'dissolve_subgraph',
    ]));
    expect(addNode?.properties?.node?.properties).toHaveProperty('parentId');
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
});
