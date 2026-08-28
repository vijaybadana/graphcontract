import { ProposalResult } from '@/src/application/workspace';
import {
  enumerateScenarios,
  nodeKinds,
  validateGraph,
  WorkflowGraph,
  GraphProposal,
  BranchScenario,
} from '@/src/domain';

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

export type WebMcpWorkspacePort = {
  getSnapshot: () => {
    graph: WorkflowGraph;
    proposal: GraphProposal | null;
    scenarios: BranchScenario[];
  };
  submitProposal: (input: unknown) => ProposalResult;
};

const operationSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'node'],
      properties: {
        type: { const: 'add_node' },
        node: {
          type: 'object',
          required: ['id', 'kind', 'label', 'position'],
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: nodeKinds },
            label: { type: 'string' },
            description: { type: 'string' },
            position: {
              type: 'object',
              required: ['x', 'y'],
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
            hitl: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                timing: { enum: ['before', 'after', 'conditional'] },
                inputType: { enum: ['approval', 'text', 'selection'] },
              },
            },
          },
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'nodeId', 'patch'],
      properties: { type: { const: 'update_node' }, nodeId: { type: 'string' }, patch: { type: 'object' } },
    },
    {
      type: 'object',
      required: ['type', 'nodeId'],
      properties: { type: { const: 'remove_node' }, nodeId: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['type', 'edge'],
      properties: {
        type: { const: 'add_edge' },
        edge: {
          type: 'object',
          required: ['id', 'source', 'target', 'mode'],
          properties: {
            id: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
            mode: { enum: ['normal', 'conditional', 'fallback'] },
            label: { type: 'string' },
            condition: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'edgeId', 'patch'],
      properties: { type: { const: 'update_edge' }, edgeId: { type: 'string' }, patch: { type: 'object' } },
    },
    {
      type: 'object',
      required: ['type', 'edgeId'],
      properties: { type: { const: 'remove_edge' }, edgeId: { type: 'string' } },
    },
  ],
};

export async function registerWebMcpTools(
  modelContext: ModelContext,
  port: WebMcpWorkspacePort,
  signal: AbortSignal,
) {
  await Promise.all([
    modelContext.registerTool(
      {
        name: 'get_graph',
        title: 'Read the accepted workflow graph',
        description:
          'Returns the accepted GraphContract graph and validation state. Proposed changes are reported separately and never treated as accepted.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false },
        execute: async () => {
          const { graph, proposal } = port.getSnapshot();
          const issues = validateGraph(graph);
          return JSON.stringify({
            ok: true,
            graph,
            validation: { validForFreeze: issues.length === 0, issues },
            pendingProposal: proposal
              ? {
                  id: proposal.id,
                  status: proposal.status,
                  rationale: proposal.rationale,
                  createdAt: proposal.createdAt,
                }
              : undefined,
          });
        },
      },
      { signal },
    ),
    modelContext.registerTool(
      {
        name: 'propose_graph_changes',
        title: 'Propose structured workflow changes',
        description:
          'Creates a review-only proposal. It cannot approve, reject, freeze, or directly modify the accepted graph.',
        inputSchema: {
          type: 'object',
          required: ['operations', 'rationale'],
          properties: {
            operations: { type: 'array', minItems: 1, items: operationSchema },
            rationale: { type: 'string', minLength: 1 },
            expectedGraphUpdatedAt: { type: 'string' },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
        execute: async (input) => JSON.stringify(port.submitProposal(input)),
      },
      { signal },
    ),
    modelContext.registerTool(
      {
        name: 'get_branch_scenarios',
        title: 'Read frozen graph branch scenarios',
        description:
          'Returns every reachable Start-to-End scenario. The human must freeze a valid graph in the UI first.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false },
        execute: async () => {
          const { graph, scenarios } = port.getSnapshot();
          if (graph.status !== 'frozen') {
            return JSON.stringify({
              ok: false,
              error: { code: 'GRAPH_NOT_FROZEN', message: 'The human has not frozen the graph.' },
            });
          }
          const issues = validateGraph(graph);
          if (issues.length > 0) {
            return JSON.stringify({
              ok: false,
              error: { code: 'GRAPH_INVALID', message: 'The frozen graph is invalid.', issues },
            });
          }
          return JSON.stringify({
            ok: true,
            graphId: graph.id,
            scenarios: scenarios.length > 0 ? scenarios : enumerateScenarios(graph),
          });
        },
      },
      { signal },
    ),
  ]);
}

export function getDocumentModelContext(): ModelContext | undefined {
  return (document as Document & { modelContext?: ModelContext }).modelContext;
}
