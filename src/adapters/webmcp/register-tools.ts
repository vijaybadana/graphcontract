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

const workingStateCapabilitySchema = {
  type: 'object',
  required: ['enabled', 'schema', 'reducers'],
  properties: {
    enabled: { type: 'boolean' },
    schema: {
      type: 'object', required: ['fields'],
      properties: { fields: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
      additionalProperties: false,
    },
    reducers: {
      type: 'array',
      items: {
        type: 'object', required: ['key', 'summary'],
        properties: { key: { type: 'string' }, summary: { type: 'string' } }, additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const checkpointerCapabilitySchema = {
  type: 'object',
  required: ['enabled', 'durableThread'],
  properties: {
    enabled: { type: 'boolean' }, backend: { type: 'string' },
    durableThread: {
      type: 'object', required: ['required'],
      properties: { required: { type: 'boolean' }, threadIdSource: { type: 'string' } },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const longTermStoreCapabilitySchema = {
  type: 'object', required: ['available'],
  properties: { available: { type: 'boolean' }, namespace: { type: 'string' }, retention: { type: 'string' } },
  additionalProperties: false,
};

const runtimeModeCapabilitySchema = {
  type: 'object', required: ['mode'],
  properties: { mode: { enum: ['unspecified', 'text', 'voice'] }, input: { enum: ['text', 'audio'] } },
  additionalProperties: false,
};

const graphCapabilitiesPatchSchema = {
  type: 'object',
  description: 'Replaces supplied complete graph-level capability records. State, Checkpointer, Store, and runtime mode remain distinct.',
  properties: {
    state: workingStateCapabilitySchema,
    checkpointer: checkpointerCapabilitySchema,
    store: longTermStoreCapabilitySchema,
    runtimeMode: runtimeModeCapabilitySchema,
  },
  additionalProperties: false,
};

const singleSubgraphCapabilityOverrideSchema = {
  oneOf: [
    { type: 'object', required: ['state'], properties: { state: workingStateCapabilitySchema }, additionalProperties: false },
    { type: 'object', required: ['checkpointer'], properties: { checkpointer: checkpointerCapabilitySchema }, additionalProperties: false },
    { type: 'object', required: ['store'], properties: { store: longTermStoreCapabilitySchema }, additionalProperties: false },
  ],
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
    capabilityOverrides: {
      type: 'object',
      properties: { state: workingStateCapabilitySchema, checkpointer: checkpointerCapabilitySchema, store: longTermStoreCapabilitySchema },
      additionalProperties: false,
    },
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

const stepStoreAccessSchema = {
  type: 'object',
  description: 'Direct Step Store access. It is valid only when Store is available in the Step’s effective graph or subgraph scope.',
  properties: {
    read: {
      type: 'object', properties: { namespace: { type: 'string' }, key: { type: 'string' } }, additionalProperties: false,
    },
    write: {
      type: 'object', properties: { namespace: { type: 'string' }, key: { type: 'string' }, retention: { type: 'string' } }, additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const retryPolicySchema = {
  type: 'object',
  description: 'Internal Step retry policy. It never creates a topology loop or runtime authority.',
  properties: {
    maxAttempts: { type: 'integer', minimum: 2, maximum: 10 },
    backoff: {
      type: 'object',
      properties: {
        strategy: { enum: ['fixed', 'exponential'] }, initialDelayMs: { type: 'integer', minimum: 0 }, maxDelayMs: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
    retryOn: { type: 'array', items: { type: 'string' } },
    fallback: {
      type: 'object', properties: { provider: { type: 'string' }, model: { type: 'string' } }, additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const mergeCompletionSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['mode'],
      properties: { mode: { const: 'all' } },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['mode'],
      properties: { mode: { const: 'any' } },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['mode', 'quorum'],
      properties: {
        mode: { const: 'quorum' },
        quorum: { type: 'integer', minimum: 1 },
      },
      additionalProperties: false,
    },
  ],
};

const mergeConfigSchema = {
  type: 'object',
  description:
    'First-class Merge configuration. A Merge is a non-work junction: reducer and completion configuration are required and Step-only fields are forbidden.',
  required: ['reducer', 'completion', 'continuation', 'waitingForDynamicInputs'],
  properties: {
    reducer: {
      type: 'object',
      required: ['name', 'aggregateState'],
      properties: {
        name: { type: 'string', minLength: 1 },
        aggregateState: { type: 'string', minLength: 1 },
      },
      additionalProperties: false,
    },
    completion: mergeCompletionSchema,
    continuation: {
      type: 'object',
      required: ['mode'],
      properties: { mode: { enum: ['once', 'per_batch'] } },
      additionalProperties: false,
    },
    waitingForDynamicInputs: { const: true },
  },
  additionalProperties: false,
};

const sendMapConfigSchema = {
  type: 'object',
  description:
    'Strict design-time Send/map configuration. destinationTemplateId must equal the edge target; it identifies one template Step, never materialized runtime workers.',
  required: ['destinationTemplateId', 'multiplicity', 'payloadLabel', 'mergeNodeId'],
  properties: {
    destinationTemplateId: { type: 'string', minLength: 1 },
    multiplicity: { const: 'dynamic' },
    payloadLabel: { type: 'string', minLength: 1 },
    mergeNodeId: { type: 'string', minLength: 1 },
    payloadSchemaRef: { type: 'string', minLength: 1 },
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
  storeAccess: stepStoreAccessSchema,
  retry: retryPolicySchema,
};

const nodePatchSchema = {
  type: 'object',
  properties: {
    ...nodeBaseProperties,
    ...stepProperties,
    storeAccess: { anyOf: [stepStoreAccessSchema, { type: 'null' }] },
    retry: { anyOf: [retryPolicySchema, { type: 'null' }] },
    merge: mergeConfigSchema,
    sensitive: {
      anyOf: [sensitiveEffectPolicySchema, { type: 'null' }],
      description:
        'Sets the independent sensitive-effect policy, or null to remove it from an existing Step. Removal is still review-only.',
    },
  },
  description:
    'Updates an existing node. executor, participation, hitl, sensitive, and modifiers are Step-only. merge is Merge-only; Start and End accept only label, description, position, and config changes.',
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
      required: ['id', 'kind', 'label', 'position', 'merge'],
      properties: {
        id: { type: 'string' },
        kind: { const: 'merge' },
        ...nodeBaseProperties,
        parentId: { type: 'string' },
        merge: mergeConfigSchema,
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

const nonSendEdgeSchema = {
  type: 'object',
  required: ['id', 'source', 'target', 'mode'],
  properties: {
    id: { type: 'string' },
    source: { type: 'string' },
    target: { type: 'string' },
    mode: { enum: ['normal', 'conditional', 'command', 'fallback'] },
    label: { type: 'string' },
    condition: { type: 'string' },
    loopCap: { type: 'integer', minimum: 1, maximum: 10 },
  },
  additionalProperties: false,
};

const sendEdgeSchema = {
  type: 'object',
  required: ['id', 'source', 'target', 'mode', 'send'],
  properties: {
    id: { type: 'string' },
    source: { type: 'string' },
    target: { type: 'string' },
    mode: { const: 'send' },
    label: { type: 'string' },
    loopCap: { type: 'integer', minimum: 1, maximum: 10 },
    send: sendMapConfigSchema,
  },
  additionalProperties: false,
};

const edgeSchema = { oneOf: [nonSendEdgeSchema, sendEdgeSchema] };

const nonSendEdgePatchSchema = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    target: { type: 'string' },
    mode: { enum: ['normal', 'conditional', 'command', 'fallback'] },
    label: { type: 'string' },
    condition: { type: 'string' },
    loopCap: { type: 'integer', minimum: 1, maximum: 10 },
  },
  additionalProperties: false,
};

const sendEdgePatchSchema = {
  type: 'object',
  required: ['mode', 'send'],
  properties: {
    source: { type: 'string' },
    target: { type: 'string' },
    mode: { const: 'send' },
    label: { type: 'string' },
    loopCap: { type: 'integer', minimum: 1, maximum: 10 },
    send: sendMapConfigSchema,
  },
  additionalProperties: false,
};

const edgePatchSchema = { oneOf: [nonSendEdgePatchSchema, sendEdgePatchSchema] };

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
      required: ['type', 'patch'],
      properties: {
        type: { const: 'update_graph_capabilities' },
        patch: graphCapabilitiesPatchSchema,
      },
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'override'],
      properties: {
        type: { const: 'set_subgraph_capability_override' },
        subgraphId: { type: 'string' },
        override: singleSubgraphCapabilityOverrideSchema,
      },
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'capability'],
      properties: {
        type: { const: 'remove_subgraph_capability_override' },
        subgraphId: { type: 'string' },
        capability: { enum: ['state', 'checkpointer', 'store'] },
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
        edge: edgeSchema,
      },
    },
    {
      type: 'object',
      required: ['type', 'edgeId', 'patch'],
      properties: {
        type: { const: 'update_edge' },
        edgeId: { type: 'string' },
        patch: edgePatchSchema,
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
                  operations: proposal.operations,
                  diff: proposal.diff,
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
          'Creates a review-only proposal. Nodes are exactly Start, Step, Merge, or End; every added Step requires an executor, while Merge is a non-work reducer junction. State, Checkpointer, Store, and runtime-mode records are distinct graph capabilities; set or remove one supported subgraph override at a time, and declare direct Step Store read/write only where Store is available in effective scope. Retry is an internal Step policy, never a topology loop or runtime authority. Send is a strict design-time edge mode with one canonical template destination, dynamic multiplicity, payload metadata, and a Merge target; it never creates runtime workers. loopCap is optional and bounded to 1..10. HITL is an independent Step modifier with before/inside/after timing, approval/text/selection response types, configured human outcomes, and resume destinations on canonical outgoing edges. Sensitive effect policy is independent from HITL; approvalRequired needs an enabled before approval gate with an approve outcome, and this tool never adds one implicitly. Operations are applied progressively to a candidate and the completed candidate validates atomically; no accepted graph changes until a human approves in the UI. Include expectedGraphUpdatedAt from get_graph when available. It cannot approve, reject, respond, resume, freeze, mutate runtime projections, or directly modify accepted state.',
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
