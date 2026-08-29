import { describe, expect, it } from 'vitest';

import { createProposal, sampleGraph } from '@/src/domain';
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
      properties?: { operations?: { items?: { oneOf?: Array<{ properties?: { type?: { const?: string }; node?: { properties?: Record<string, unknown> } } }> } } };
    };
    const variants = proposalSchema.properties?.operations?.items?.oneOf ?? [];
    const operationTypes = variants.map((variant) => variant.properties?.type?.const);
    const addNode = variants.find((variant) => variant.properties?.type?.const === 'add_node');

    expect(proposalSchema.required).toEqual(['operations', 'rationale']);
    expect(operationTypes).toEqual(expect.arrayContaining([
      'add_subgraph',
      'update_subgraph',
      'assign_nodes_to_subgraph',
      'remove_nodes_from_subgraph',
      'dissolve_subgraph',
    ]));
    expect(addNode?.properties?.node?.properties).toHaveProperty('parentId');
  });
});
