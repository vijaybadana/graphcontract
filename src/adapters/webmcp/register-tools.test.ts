import { describe, expect, it } from 'vitest';

import { sampleGraph } from '@/src/domain';
import { registerWebMcpTools } from './register-tools';

type RegisteredTool = {
  name: string;
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

    await registerWebMcpTools(
      modelContext as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => ({
          graph: structuredClone(sampleGraph),
          proposal: null,
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
    expect(graphResult).toMatchObject({ ok: true, graph: { id: sampleGraph.id } });
    expect(proposalResult).toEqual(proposalResponse);
    expect(scenarioResult).toEqual({
      ok: false,
      error: { code: 'GRAPH_NOT_FROZEN', message: 'The human has not frozen the graph.' },
    });
  });
});
