import { ProposalResult } from '@/src/application/workspace';
import {
  enumerateScenarios,
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

const hitlSchema = {
  type: 'object',
  description:
    'Optional human-in-the-loop Step modifier. An enabled gate needs a timing and response contract in the final candidate; the proposal is validated after all operations are applied.',
  required: ['enabled'],
  properties: {
    enabled: { type: 'boolean' },
    timing: {
      enum: ['before', 'inside', 'after'],
      description: 'Gate boundary: before execution, inside execution, or after result production.',
    },
    response: {
      type: 'object',
      description:
        'Human response contract. Each allowed outcome resumes only through an existing outgoing edge from this Step; this proposal cannot create a response or resume a runtime.',
      required: ['type', 'allowedOutcomes'],
      properties: {
        type: {
          enum: ['approval', 'text', 'selection'],
          description: 'The response payload expected from the human.',
        },
        selectionChoices: {
          type: 'array',
          description: 'Choices shown to a human for a selection response; omit for approval and text responses.',
          items: {
            type: 'object',
            required: ['id', 'label'],
            properties: { id: { type: 'string', minLength: 1 }, label: { type: 'string', minLength: 1 } },
            additionalProperties: false,
          },
        },
        allowedOutcomes: {
          type: 'array',
          description:
            'One or more semantic human outcomes. resumeNodeId must target a canonical outgoing edge from the gated Step in the completed candidate.',
          items: {
            type: 'object',
            required: ['id', 'label', 'resumeNodeId'],
            properties: {
              id: { type: 'string', minLength: 1 },
              label: { type: 'string', minLength: 1 },
              resumeNodeId: { type: 'string', minLength: 1 },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    activation: {
      type: 'object',
      description: 'Optional reason for activating the gate; it does not change executor ownership.',
      properties: { reason: { type: 'string', minLength: 1 } },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const sensitiveEffectPolicySchema = {
  type: 'object',
  description:
    'Independent sensitive-effect policy. Its presence marks the Step Sensitive; it never creates a HITL gate. approvalRequired needs an eligible before approval gate in the completed candidate.',
  required: ['target', 'authorization', 'approvalRequired', 'idempotency'],
  properties: {
    target: { type: 'string', minLength: 1 },
    authorization: { type: 'string', minLength: 1 },
    approvalRequired: { type: 'boolean' },
    idempotency: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
};

const stepParticipationSchema = {
  type: 'object',
  properties: { internalTools: { const: true } },
  additionalProperties: false,
};

const stepModifierSchema = {
  type: 'object',
  properties: {
    guardrail: { const: true },
    storeRead: { const: true },
    storeWrite: { const: true },
    retryFallback: { const: true },
    opaque: { const: true },
    readiness: { enum: ['degraded', 'unimplemented'] },
  },
  additionalProperties: false,
};

const nodeBaseProperties = {
  label: { type: 'string' },
  description: { type: 'string' },
  position: positionSchema,
  config: { type: 'object' },
};

const stepProperties = {
  executor: { enum: ['deterministic', 'ai', 'tool', 'human'] },
  participation: stepParticipationSchema,
  hitl: hitlSchema,
  sensitive: sensitiveEffectPolicySchema,
  modifiers: stepModifierSchema,
};

const nodePatchSchema = {
  type: 'object',
  properties: {
    ...nodeBaseProperties,
    ...stepProperties,
    sensitive: {
      anyOf: [sensitiveEffectPolicySchema, { type: 'null' }],
      description:
        'Sets the independent sensitive-effect policy, or null to remove it from an existing Step. Removal is still review-only.',
    },
  },
  description:
    'Updates an existing node. executor, participation, hitl, sensitive, and modifiers are Step-only; Start and End nodes accept only label, description, position, and config changes.',
  // Parent membership is intentionally a dedicated proposal operation.
  additionalProperties: false,
};

const addNodeSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['id', 'kind', 'label', 'position'],
      properties: {
        id: { type: 'string' },
        kind: { const: 'start' },
        ...nodeBaseProperties,
        parentId: { type: 'string' },
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['id', 'kind', 'label', 'position', 'executor'],
      properties: {
        id: { type: 'string' },
        kind: { const: 'step' },
        ...nodeBaseProperties,
        parentId: { type: 'string' },
        ...stepProperties,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['id', 'kind', 'label', 'position'],
      properties: {
        id: { type: 'string' },
        kind: { const: 'end' },
        ...nodeBaseProperties,
        parentId: { type: 'string' },
      },
      additionalProperties: false,
    },
  ],
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
        node: addNodeSchema,
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
          'Creates a review-only proposal. Nodes are exactly Start, Step, or End; every added Step requires an executor. HITL is an independent Step modifier with before/inside/after timing, approval/text/selection response types, configured human outcomes, and resume destinations on canonical outgoing edges. Sensitive effect policy is independent from HITL; approvalRequired needs an enabled before approval gate with an approve outcome, and this tool never adds one implicitly. Start and End never accept Step-only fields. Operations are applied progressively to a candidate and the completed candidate validates atomically; no accepted graph changes until a human approves in the UI. Include expectedGraphUpdatedAt from get_graph when available. It cannot approve, reject, respond, resume, freeze, or directly modify accepted state.',
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
