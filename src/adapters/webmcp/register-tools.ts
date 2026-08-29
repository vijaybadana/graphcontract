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

const positionSchema = {
  type: 'object',
  required: ['x', 'y'],
  properties: { x: { type: 'number' }, y: { type: 'number' } },
  additionalProperties: false,
};

const subgraphSchema = {
  type: 'object',
  required: ['id', 'label', 'position', 'dimensions', 'collapsed'],
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    position: positionSchema,
    dimensions: {
      type: 'object',
      required: ['width', 'height'],
      properties: { width: { type: 'number', exclusiveMinimum: 0 }, height: { type: 'number', exclusiveMinimum: 0 } },
      additionalProperties: false,
    },
    collapsed: { type: 'boolean' },
  },
  additionalProperties: false,
};

const nodePatchSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: nodeKinds },
    label: { type: 'string' },
    description: { type: 'string' },
    position: positionSchema,
    config: { type: 'object' },
    hitl: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        timing: { enum: ['before', 'after', 'conditional'] },
        inputType: { enum: ['approval', 'text', 'selection'] },
        condition: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  // Parent membership is intentionally a dedicated proposal operation.
  additionalProperties: false,
};

const subgraphPatchSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    position: positionSchema,
    dimensions: subgraphSchema.properties.dimensions,
    collapsed: { type: 'boolean' },
  },
  additionalProperties: false,
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
            position: positionSchema,
            parentId: { type: 'string' },
            config: { type: 'object' },
            hitl: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                timing: { enum: ['before', 'after', 'conditional'] },
                inputType: { enum: ['approval', 'text', 'selection'] },
                condition: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'nodeId', 'patch'],
      properties: { type: { const: 'update_node' }, nodeId: { type: 'string' }, patch: nodePatchSchema },
    },
    {
      type: 'object',
      required: ['type', 'nodeId'],
      properties: { type: { const: 'remove_node' }, nodeId: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['type', 'subgraph'],
      properties: { type: { const: 'add_subgraph' }, subgraph: subgraphSchema },
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'patch'],
      properties: {
        type: { const: 'update_subgraph' },
        subgraphId: { type: 'string' },
        patch: subgraphPatchSchema,
      },
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'nodeIds'],
      properties: {
        type: { const: 'assign_nodes_to_subgraph' },
        subgraphId: { type: 'string' },
        nodeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
      },
    },
    {
      type: 'object',
      required: ['type', 'nodeIds'],
      properties: {
        type: { const: 'remove_nodes_from_subgraph' },
        nodeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
      },
    },
    {
      type: 'object',
      required: ['type', 'subgraphId'],
      properties: { type: { const: 'dissolve_subgraph' }, subgraphId: { type: 'string' } },
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
            mode: { type: 'string', enum: ['normal', 'conditional', 'command', 'fallback'] },
            label: { type: 'string' },
            condition: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'edgeId', 'patch'],
      properties: {
        type: { const: 'update_edge' },
        edgeId: { type: 'string' },
        patch: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            target: { type: 'string' },
            mode: { type: 'string', enum: ['normal', 'conditional', 'command', 'fallback'] },
            label: { type: 'string' },
            condition: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
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
          return {
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
          };
        },
      },
      { signal },
    ),
    modelContext.registerTool(
      {
        name: 'propose_graph_changes',
        title: 'Propose structured workflow changes',
        description:
          'Creates a review-only proposal. Operations may add or update canonical source-to-target edges as normal, conditional, command, or fallback routes; a return source/target connection forms derived loop topology and is never a loop mode. Include expectedGraphUpdatedAt from get_graph when available. It cannot approve, reject, freeze, or directly modify the accepted graph.',
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
        execute: async (input) => port.submitProposal(input),
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
            return {
              ok: false,
              error: { code: 'GRAPH_NOT_FROZEN', message: 'The human has not frozen the graph.' },
            };
          }
          const issues = validateGraph(graph);
          if (issues.length > 0) {
            return {
              ok: false,
              error: { code: 'GRAPH_INVALID', message: 'The frozen graph is invalid.', issues },
            };
          }
          return {
            ok: true,
            graphId: graph.id,
            scenarios: scenarios.length > 0 ? scenarios : enumerateScenarios(graph),
          };
        },
      },
      { signal },
    ),
  ]);
}

export function getDocumentModelContext(): ModelContext | undefined {
  return (document as Document & { modelContext?: ModelContext }).modelContext;
}
