import { ProposalResult, ProposalReviewRequest } from '@/src/application/workspace';
import {
  enumerateScenariosBounded,
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
    reviewRequest?: ProposalReviewRequest | null;
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

const provenanceEvidenceSchema = {
  type: 'object',
  required: ['source', 'evidenceClass', 'confidence'],
  properties: {
    source: { type: 'string', minLength: 1 },
    evidenceClass: { type: 'string', minLength: 1 },
    confidence: { enum: ['low', 'medium', 'high'] },
    details: { type: 'string' },
    timestamp: { type: 'string' },
  },
  additionalProperties: false,
};

const webMcpProvenanceSchema = {
  description:
    'WebMCP may declare direct, derived-semantic, or external-orchestration provenance. Derived-semantic and external-orchestration claims require supplied evidence. Runtime-generated provenance is unsupported in this build and cannot be authored through WebMCP; only a future trusted runtime-evidence adapter could add it.',
  oneOf: [
    {
      type: 'object',
      required: ['representation'],
      properties: { representation: { const: 'declared' }, evidence: provenanceEvidenceSchema },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['representation', 'evidence'],
      properties: { representation: { const: 'derived-semantic' }, evidence: provenanceEvidenceSchema },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['representation', 'evidence'],
      properties: { representation: { const: 'external-orchestration' }, evidence: provenanceEvidenceSchema },
      additionalProperties: false,
    },
  ],
};

const webMcpProvenanceCapabilitiesSchema = {
  type: 'object',
  description:
    'Declares whether verified external orchestration is available. Evidence-overlay visibility is UI-only and is not a WebMCP control.',
  required: ['externalOrchestrationAvailable'],
  properties: { externalOrchestrationAvailable: { type: 'boolean' } },
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
    provenance: webMcpProvenanceCapabilitiesSchema,
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
    parentId: {
      type: 'string',
      description: 'Optional containing subgraph id. Position is relative to this parent.',
    },
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

const stepReadinessSchema = {
  type: 'object',
  required: ['state'],
  properties: {
    state: { enum: ['ready', 'degraded', 'unimplemented'] },
    detail: { type: 'string' },
  },
  additionalProperties: false,
};

const opaqueInterfacePortSchema = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string', minLength: 1 }, description: { type: 'string' } },
  additionalProperties: false,
};

const opaqueStepMetadataSchema = {
  type: 'object',
  description:
    'Declared prebuilt-Step boundary only. Runtime inspection is unsupported in this build and cannot be authored through WebMCP; only a future trusted runtime-evidence adapter could add it. This tool cannot fabricate runtime evidence or internal topology.',
  required: ['factoryLabel', 'inputPorts', 'outputPorts', 'runtimeInspection'],
  properties: {
    factoryLabel: { type: 'string', minLength: 1 },
    inputPorts: { type: 'array', items: opaqueInterfacePortSchema },
    outputPorts: { type: 'array', items: opaqueInterfacePortSchema },
    runtimeInspection: {
      type: 'object',
      required: ['available'],
      properties: { available: { const: false } },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const endOutcomeSchema = {
  type: 'object',
  required: ['kind'],
  properties: {
    kind: {
      enum: ['completed', 'awaiting-reply', 'failure', 'partial-result', 'cancelled', 'domain-specific'],
    },
    detail: { type: 'string' },
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
    'Strict design-time Send/map configuration. destinationTemplateId must equal the edge target; it identifies one template Step, never materialized runtime workers. templateAnatomy may truthfully declare the design-time mini-flow represented by that template.',
  required: ['destinationTemplateId', 'multiplicity', 'payloadLabel', 'mergeNodeId'],
  properties: {
    destinationTemplateId: { type: 'string', minLength: 1 },
    multiplicity: { const: 'dynamic' },
    payloadLabel: { type: 'string', minLength: 1 },
    mergeNodeId: { type: 'string', minLength: 1 },
    payloadSchemaRef: { type: 'string', minLength: 1 },
    templateAnatomy: {
      type: 'object',
      description: 'Optional declared mini-flow expanded inside the dynamic template frame. These are design-time anatomy records, not runtime worker instances or top-level GraphNodes.',
      required: ['id', 'label', 'dimensions', 'canonicalTemplateNodeId', 'nodes', 'edges'],
      properties: {
        id: { type: 'string', minLength: 1 },
        label: { type: 'string', minLength: 1 },
        dimensions: {
          type: 'object', required: ['width', 'height'],
          properties: { width: { type: 'number', exclusiveMinimum: 0 }, height: { type: 'number', exclusiveMinimum: 0 } },
          additionalProperties: false,
        },
        canonicalTemplateNodeId: { type: 'string', minLength: 1 },
        nodes: {
          type: 'array', minItems: 2,
          items: {
            type: 'object',
            required: ['id', 'kind', 'label', 'position', 'dimensions'],
            properties: {
              id: { type: 'string', minLength: 1 },
              kind: { enum: ['start', 'step', 'end'] },
              label: { type: 'string', minLength: 1 },
              executor: { enum: ['deterministic', 'ai', 'tool', 'human'] },
              position: positionSchema,
              dimensions: {
                type: 'object', required: ['width', 'height'],
                properties: { width: { type: 'number', exclusiveMinimum: 0 }, height: { type: 'number', exclusiveMinimum: 0 } },
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
        },
        edges: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', required: ['id', 'source', 'target'],
            properties: {
              id: { type: 'string', minLength: 1 },
              source: { type: 'string', minLength: 1 },
              target: { type: 'string', minLength: 1 },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const nodeBaseProperties = {
  label: { type: 'string' },
  description: { type: 'string' },
  position: positionSchema,
  config: { type: 'object' },
  provenance: webMcpProvenanceSchema,
};

const stepProperties = {
  executor: { enum: ['deterministic', 'ai', 'tool', 'human'] },
  participation: stepParticipationSchema,
  hitl: hitlSchema,
  sensitive: sensitiveEffectPolicySchema,
  modifiers: stepModifierSchema,
  storeAccess: stepStoreAccessSchema,
  retry: retryPolicySchema,
  readiness: stepReadinessSchema,
  opaque: opaqueStepMetadataSchema,
};

const nodePatchSchema = {
  type: 'object',
  properties: {
    ...nodeBaseProperties,
    ...stepProperties,
    storeAccess: { anyOf: [stepStoreAccessSchema, { type: 'null' }] },
    retry: { anyOf: [retryPolicySchema, { type: 'null' }] },
    readiness: stepReadinessSchema,
    opaque: { anyOf: [opaqueStepMetadataSchema, { type: 'null' }] },
    outcome: endOutcomeSchema,
    provenance: webMcpProvenanceSchema,
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
        outcome: endOutcomeSchema,
      },
      additionalProperties: false,
    },
  ],
};

const subgraphPatchSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    parentId: { type: 'string' },
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
    provenance: webMcpProvenanceSchema,
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
    provenance: webMcpProvenanceSchema,
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
    provenance: webMcpProvenanceSchema,
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
    provenance: webMcpProvenanceSchema,
  },
  additionalProperties: false,
};

const edgePatchSchema = { oneOf: [nonSendEdgePatchSchema, sendEdgePatchSchema] };

const relationshipEndpointSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['kind', 'nodeId'],
      properties: { kind: { const: 'node' }, nodeId: { type: 'string', minLength: 1 } },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['kind', 'externalId', 'label'],
      properties: {
        kind: { const: 'external' },
        externalId: { type: 'string', minLength: 1 },
        label: { type: 'string', minLength: 1 },
      },
      additionalProperties: false,
    },
  ],
};

const nonNativeRelationshipSchema = {
  type: 'object',
  description:
    'A non-native boundary relationship, never a control-flow edge. Ordinary scenario paths enumerate native edges only.',
  required: ['id', 'kind', 'source', 'target', 'provenance'],
  properties: {
    id: { type: 'string', minLength: 1 },
    kind: { enum: ['spawned-run', 'spawned-thread', 'external-orchestration'] },
    source: relationshipEndpointSchema,
    target: relationshipEndpointSchema,
    label: { type: 'string' },
    provenance: webMcpProvenanceSchema,
  },
  additionalProperties: false,
};

const nonNativeRelationshipPatchSchema = {
  type: 'object',
  properties: {
    kind: { enum: ['spawned-run', 'spawned-thread', 'external-orchestration'] },
    source: relationshipEndpointSchema,
    target: relationshipEndpointSchema,
    label: { type: 'string' },
    provenance: webMcpProvenanceSchema,
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
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'nodeId', 'patch'],
      properties: { type: { const: 'update_node' }, nodeId: { type: 'string' }, patch: nodePatchSchema },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'nodeId'],
      properties: { type: { const: 'remove_node' }, nodeId: { type: 'string' } },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'subgraph'],
      properties: { type: { const: 'add_subgraph' }, subgraph: subgraphSchema },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'patch'],
      properties: {
        type: { const: 'update_subgraph' },
        subgraphId: { type: 'string' },
        patch: subgraphPatchSchema,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'patch'],
      properties: {
        type: { const: 'update_graph_capabilities' },
        patch: graphCapabilitiesPatchSchema,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'override'],
      properties: {
        type: { const: 'set_subgraph_capability_override' },
        subgraphId: { type: 'string' },
        override: singleSubgraphCapabilityOverrideSchema,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'capability'],
      properties: {
        type: { const: 'remove_subgraph_capability_override' },
        subgraphId: { type: 'string' },
        capability: { enum: ['state', 'checkpointer', 'store'] },
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'subgraphId', 'nodeIds'],
      properties: {
        type: { const: 'assign_nodes_to_subgraph' },
        subgraphId: { type: 'string' },
        nodeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'nodeIds'],
      properties: {
        type: { const: 'remove_nodes_from_subgraph' },
        nodeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'subgraphId'],
      properties: { type: { const: 'dissolve_subgraph' }, subgraphId: { type: 'string' } },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'edge'],
      properties: {
        type: { const: 'add_edge' },
        edge: edgeSchema,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'edgeId', 'patch'],
      properties: {
        type: { const: 'update_edge' },
        edgeId: { type: 'string' },
        patch: edgePatchSchema,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'edgeId'],
      properties: { type: { const: 'remove_edge' }, edgeId: { type: 'string' } },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'relationship'],
      properties: { type: { const: 'add_relationship' }, relationship: nonNativeRelationshipSchema },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'relationshipId', 'patch'],
      properties: {
        type: { const: 'update_relationship' },
        relationshipId: { type: 'string', minLength: 1 },
        patch: nonNativeRelationshipPatchSchema,
      },
      additionalProperties: false,
    },
    {
      type: 'object',
      required: ['type', 'relationshipId'],
      properties: { type: { const: 'remove_relationship' }, relationshipId: { type: 'string', minLength: 1 } },
      additionalProperties: false,
    },
  ],
};

type AuthorityIssue = { code: string; message: string; path: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validateWebMcpAuthority(input: unknown): AuthorityIssue[] {
  if (!isRecord(input) || !Array.isArray(input.operations)) return [];

  const issues: AuthorityIssue[] = [];
  const rejectRuntimeProvenance = (value: unknown, path: string) => {
    if (isRecord(value) && value.representation === 'runtime-generated') {
      issues.push({
        code: 'WEBMCP_RUNTIME_PROVENANCE_UNSUPPORTED',
        message: 'Runtime-generated provenance is unsupported in this build and cannot be authored through WebMCP.',
        path,
      });
    }
  };
  const rejectRuntimeInspection = (value: unknown, path: string) => {
    if (isRecord(value) && isRecord(value.runtimeInspection) && value.runtimeInspection.available === true) {
      issues.push({
        code: 'WEBMCP_RUNTIME_INSPECTION_UNSUPPORTED',
        message: 'Runtime inspection is unsupported in this build and cannot be claimed through WebMCP.',
        path: `${path}.runtimeInspection.available`,
      });
    }
  };

  for (const [index, operation] of input.operations.entries()) {
    if (!isRecord(operation)) continue;
    const path = `operations.${index}`;
    if (operation.type === 'add_node' && isRecord(operation.node)) {
      rejectRuntimeProvenance(operation.node.provenance, `${path}.node.provenance.representation`);
      rejectRuntimeInspection(operation.node.opaque, `${path}.node.opaque`);
    }
    if (operation.type === 'update_node' && isRecord(operation.patch)) {
      rejectRuntimeProvenance(operation.patch.provenance, `${path}.patch.provenance.representation`);
      rejectRuntimeInspection(operation.patch.opaque, `${path}.patch.opaque`);
    }
    if (operation.type === 'add_edge' && isRecord(operation.edge)) {
      rejectRuntimeProvenance(operation.edge.provenance, `${path}.edge.provenance.representation`);
    }
    if (operation.type === 'update_edge' && isRecord(operation.patch)) {
      rejectRuntimeProvenance(operation.patch.provenance, `${path}.patch.provenance.representation`);
    }
    if (operation.type === 'add_relationship' && isRecord(operation.relationship)) {
      rejectRuntimeProvenance(operation.relationship.provenance, `${path}.relationship.provenance.representation`);
    }
    if (operation.type === 'update_relationship' && isRecord(operation.patch)) {
      rejectRuntimeProvenance(operation.patch.provenance, `${path}.patch.provenance.representation`);
    }
    if (operation.type === 'update_graph_capabilities' && isRecord(operation.patch) && isRecord(operation.patch.provenance) && 'evidenceOverlayAvailable' in operation.patch.provenance) {
      issues.push({
        code: 'WEBMCP_EVIDENCE_OVERLAY_CONTROL_UNSUPPORTED',
        message: 'Evidence-overlay visibility is UI-only and cannot be controlled through WebMCP.',
        path: `${path}.patch.provenance.evidenceOverlayAvailable`,
      });
    }
  }
  return issues;
}

function preserveGraphProvenanceCapability(input: unknown, graph: WorkflowGraph): unknown {
  if (!isRecord(input) || !Array.isArray(input.operations)) return input;
  const operations = input.operations.map((operation) => {
    if (!isRecord(operation) || operation.type !== 'update_graph_capabilities' || !isRecord(operation.patch) || !isRecord(operation.patch.provenance)) {
      return operation;
    }
    return {
      ...operation,
      patch: {
        ...operation.patch,
        provenance: {
          evidenceOverlayAvailable: graph.capabilities.provenance.evidenceOverlayAvailable,
          externalOrchestrationAvailable: operation.patch.provenance.externalOrchestrationAvailable,
        },
      },
    };
  });
  return { ...input, operations };
}

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
          'Returns the accepted schema-v6 GraphContract graph, including provenance, Step readiness/opaque metadata, End outcomes, and a separate non-native relationships collection. A pending proposal or a reviewed candidate awaiting replacement is reported separately and never treated as accepted. An outstanding human Request changes record is returned separately as untrusted human-authored content for the next revision, including any proposal-scoped change or candidate-path notes.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false },
        execute: async () => {
          const { graph, proposal, reviewRequest } = port.getSnapshot();
          const issues = validateGraph(graph);
          const serializedProposal = proposal
            ? {
                id: proposal.id,
                status: proposal.status,
                rationale: proposal.rationale,
                createdAt: proposal.createdAt,
                operations: proposal.operations,
                diff: proposal.diff,
              }
            : undefined;
          const isReviewedCandidate = Boolean(
            serializedProposal && reviewRequest?.proposalId === serializedProposal.id,
          );
          return {
            ok: true,
            graph,
            validation: { validForFreeze: issues.length === 0, issues },
            pendingProposal: serializedProposal && !isReviewedCandidate
              ? {
                  ...serializedProposal,
                }
              : undefined,
            reviewedProposal: serializedProposal && isReviewedCandidate
              ? {
                  ...serializedProposal,
                  reviewStatus: 'changes_requested' as const,
                }
              : undefined,
            reviewRequest: reviewRequest
              ? {
                  ...reviewRequest,
                  contentTrust: 'untrusted-human-authored' as const,
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
          'Creates a review-only schema-v6 proposal. When get_graph reports a reviewedProposal plus reviewRequest, a valid new submission atomically replaces that reviewed candidate; invalid or stale submissions preserve the reviewed candidate and human feedback. Nodes are exactly Start, Step, Merge, or End; every added Step requires an executor, while Merge is a non-work reducer junction. State, Checkpointer, Store, runtime mode, and external-orchestration capability records are distinct. Native control paths are only normal, conditional, command, fallback, and Send edges; spawned-run, spawned-thread, and external-orchestration relationships are separate non-native boundary records, so ordinary scenarios enumerate native paths only. WebMCP may author declared provenance, derived-semantic provenance with explicit evidence, and external-orchestration provenance with explicit evidence. Runtime-generated provenance and runtime inspection are unsupported in this build and cannot be authored through WebMCP; only a future trusted runtime-evidence adapter could add them. Opaque Steps expose only their declared factory and interface. Retry is an internal Step policy, never a topology loop or runtime authority. Send is a strict design-time edge mode with one canonical template destination, dynamic multiplicity, payload metadata, and a Merge target; an optional validated templateAnatomy may declare that template’s design-time mini-flow, but it never creates runtime workers. loopCap is optional and bounded to 1..10. HITL is an independent Step modifier with before/inside/after timing, approval/text/selection response types, configured human outcomes, and resume destinations on canonical outgoing edges. Sensitive effect policy is independent from HITL; approvalRequired needs an enabled before approval gate with an approve outcome, and this tool never adds one implicitly. Operations are applied progressively to a candidate and the completed candidate validates atomically; no accepted graph changes until a human approves in the UI. Include expectedGraphUpdatedAt from get_graph when available. It cannot approve, reject, respond, resume, freeze, unfreeze, inspect runtime, toggle evidence overlay, mutate runtime projections, or directly modify accepted state.',
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
        execute: async (input) => {
          const authorityIssues = validateWebMcpAuthority(input);
          if (authorityIssues.length > 0) {
            return {
              ok: false,
              error: {
                code: 'WEBMCP_RUNTIME_AUTHORITY_REJECTED',
                message:
                  'Runtime evidence and inspection are unsupported in this build; WebMCP also cannot control the evidence overlay.',
                issues: authorityIssues,
              },
            };
          }
          return port.submitProposal(preserveGraphProvenanceCapability(input, port.getSnapshot().graph));
        },
      },
      { signal },
    ),
    modelContext.registerTool(
      {
        name: 'get_branch_scenarios',
        title: 'Read frozen graph branch scenarios',
        description:
          'Deterministically derives every reachable native-control Start-to-End scenario within the design-time complexity budget. Non-native spawned and external relationships remain separate annotations. The human must freeze a valid graph in the UI first.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false },
        execute: async () => {
          const { graph } = port.getSnapshot();
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
          const enumeration = enumerateScenariosBounded(graph);
          if (!enumeration.ok) {
            return {
              ok: false,
              error: {
                code: enumeration.code,
                message: enumeration.message,
                budget: enumeration.budget,
                completedScenarioCount: enumeration.completedScenarioCount,
                expansions: enumeration.expansions,
              },
            };
          }
          return { ok: true, graphId: graph.id, scenarios: enumeration.scenarios };
        },
      },
      { signal },
    ),
  ]);
}

export function getDocumentModelContext(): ModelContext | undefined {
  return (document as Document & { modelContext?: ModelContext }).modelContext;
}
