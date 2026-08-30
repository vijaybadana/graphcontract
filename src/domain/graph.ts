import { z } from 'zod';

export const nodeKinds = [
  'start',
  'step',
  'merge',
  'end',
] as const;

export type NodeKind = (typeof nodeKinds)[number];
/** Legacy input-only kinds accepted by the v1 persistence migration. */
export const legacyNodeKinds = ['agent', 'action', 'tool', 'human_input'] as const;
export type LegacyNodeKind = (typeof legacyNodeKinds)[number];
const v1NodeKinds = ['start', ...legacyNodeKinds, 'end'] as const;
type V1NodeKind = (typeof v1NodeKinds)[number];
export type RoutingEdgeMode = 'normal' | 'conditional' | 'command' | 'fallback';
export type EdgeMode = RoutingEdgeMode | 'send';
export type StepExecutor = 'deterministic' | 'ai' | 'tool' | 'human';

export type HitlTiming = 'before' | 'inside' | 'after';
export type HumanResponseType = 'approval' | 'text' | 'selection';

export type HumanSelectionChoice = {
  id: string;
  label: string;
};

/** A configured human response always resumes through an authored edge. */
export type HumanOutcome = {
  id: string;
  label: string;
  resumeNodeId: string;
};

export type HitlResponseContract = {
  type: HumanResponseType;
  selectionChoices?: HumanSelectionChoice[];
  allowedOutcomes: HumanOutcome[];
};

export type HitlConfig = {
  enabled: boolean;
  /** Required for enabled gates; omitted only while an inactive draft is configured. */
  timing?: HitlTiming;
  /** Required for enabled gates. */
  response?: HitlResponseContract;
  /** Explains why the gate is active without changing its execution owner. */
  activation?: { reason?: string };
};

/** The v2 persistence-only HITL shape. Never write this shape to v3. */
export type HitlConfigV2 = {
  enabled: boolean;
  timing?: 'before' | 'after' | 'conditional';
  inputType?: HumanResponseType;
  condition?: string;
};

export type GraphPosition = { x: number; y: number };
export type GraphDimensions = { width: number; height: number };

/** Provenance is display and inspector data, never native routing semantics. */
export const provenanceRepresentations = [
  'declared',
  'runtime-generated',
  'derived-semantic',
  'external-orchestration',
] as const;
export type ProvenanceRepresentation = (typeof provenanceRepresentations)[number];
export type EvidenceConfidence = 'low' | 'medium' | 'high';

/** Evidence values are validated as untrusted, display-only text. */
export type ProvenanceEvidence = {
  source: string;
  evidenceClass: string;
  confidence: EvidenceConfidence;
  details?: string;
  timestamp?: string;
};

export type Provenance = {
  representation: ProvenanceRepresentation;
  evidence?: ProvenanceEvidence;
};

/** Visibility stays UI-only; this only records whether the capability exists. */
export type ProvenanceCapabilities = {
  evidenceOverlayAvailable: boolean;
  externalOrchestrationAvailable: boolean;
};

/** Per-run state remains separate from checkpointing and cross-thread Store. */
export type WorkingStateCapability = {
  enabled: boolean;
  schema: { fields: string[]; summary?: string };
  reducers: Array<{ key: string; summary: string }>;
};

/** Durable resume metadata for the graph or one explicitly overridden subgraph. */
export type CheckpointerCapability = {
  enabled: boolean;
  backend?: string;
  /** Configuration source for a durable thread identifier, never a live thread instance. */
  durableThread: { required: boolean; threadIdSource?: string };
};

/** Cross-thread Store availability. Direct Step access is declared separately. */
export type LongTermStoreCapability = {
  available: boolean;
  namespace?: string;
  retention?: string;
};

/** Runtime mode is graph-level; subgraphs intentionally cannot override it. */
export type RuntimeModeCapability = {
  mode: 'unspecified' | 'text' | 'voice';
  input?: 'text' | 'audio';
};

export type GraphCapabilities = {
  state: WorkingStateCapability;
  checkpointer: CheckpointerCapability;
  store: LongTermStoreCapability;
  runtimeMode: RuntimeModeCapability;
  provenance: ProvenanceCapabilities;
};

/** Only State, Checkpointer, and Store have meaningful subgraph scope. */
export type GraphCapabilityOverrides = Partial<
  Pick<GraphCapabilities, 'state' | 'checkpointer' | 'store'>
>;

/** A proposal may replace one complete graph capability record at a time. */
export type GraphCapabilitiesPatch = Partial<GraphCapabilities>;

export type CapabilitySource = 'graph' | 'inherited' | 'overridden';

export type EffectiveCapability<T> = {
  source: CapabilitySource;
  value: T;
};

export type EffectiveGraphCapabilities = {
  state: EffectiveCapability<WorkingStateCapability>;
  checkpointer: EffectiveCapability<CheckpointerCapability>;
  store: EffectiveCapability<LongTermStoreCapability>;
  runtimeMode: EffectiveCapability<RuntimeModeCapability>;
};

export type GraphSubgraphBase = {
  id: string;
  label: string;
  position: GraphPosition;
  dimensions: GraphDimensions;
  collapsed: boolean;
};

/** v1-v4 persisted containers have no durability capability metadata. */
export type GraphSubgraphV4 = GraphSubgraphBase;

export type GraphSubgraph = GraphSubgraphBase & {
  capabilityOverrides?: GraphCapabilityOverrides;
};

type GraphNodeBase = {
  id: string;
  label: string;
  description?: string;
  /** Relative to its parent subgraph when parentId is present. */
  position: GraphPosition;
  parentId?: string;
  config?: Record<string, unknown>;
  /** Defaults to declared during v5 migration without inventing evidence. */
  provenance?: Provenance;
};

export type StepModifierSummary = {
  /** A guardrail policy exists; its detail remains inspector-owned. */
  guardrail?: true;
  /** This Step directly reads from the long-term Store. */
  storeRead?: true;
  /** This Step directly writes to the long-term Store. */
  storeWrite?: true;
  /** An internal retry or provider-fallback policy exists; it is not a loop edge. */
  retryFallback?: true;
  /** The Step is a prebuilt/opaque unit with limited introspection. */
  opaque?: true;
  /** Omit when ready; degraded and unimplemented need an explicit status. */
  readiness?: 'degraded' | 'unimplemented';
};

export type StepReadiness = {
  state: 'ready' | 'degraded' | 'unimplemented';
  /** Optional operator-safe explanation; it is never executable instruction text. */
  detail?: string;
};

export type OpaqueInterfacePort = {
  name: string;
  description?: string;
};

export type RuntimeInspectionAvailability = {
  available: boolean;
  /** An available inspection must carry supplied evidence; migration never fabricates it. */
  evidence?: ProvenanceEvidence;
};

/** A prebuilt Step declares only its known boundary, never child topology. */
export type OpaqueStepMetadata = {
  factoryLabel: string;
  inputPorts: OpaqueInterfacePort[];
  outputPorts: OpaqueInterfacePort[];
  runtimeInspection: RuntimeInspectionAvailability;
};

export type EndOutcomeKind =
  | 'completed'
  | 'awaiting-reply'
  | 'failure'
  | 'partial-result'
  | 'cancelled'
  | 'domain-specific';

export type EndOutcome = {
  kind: EndOutcomeKind;
  /** Required only when the product needs a domain-specific terminal result. */
  detail?: string;
};

/** Direct Store use is a Step capability, never an implied graph edge. */
export type StepStoreAccess = {
  read?: { namespace?: string; key?: string };
  write?: { namespace?: string; key?: string; retention?: string };
};

/** Internal retry policy. It is intentionally independent of graph topology. */
export type RetryPolicy = {
  maxAttempts?: number;
  backoff?: {
    strategy?: 'fixed' | 'exponential';
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
  retryOn?: string[];
  fallback?: { provider?: string; model?: string };
};

/** v2 compatibility summary. Active v3 derives Sensitive from `sensitive`. */
export type StepModifierSummaryV2 = StepModifierSummary & {
  sensitiveSideEffect?: true;
};

export type StepParticipation = {
  /** The Step makes internal tool calls without becoming a Tool executor. */
  internalTools?: true;
};

export type SensitiveEffectPolicy = {
  target: string;
  authorization: string;
  approvalRequired: boolean;
  idempotency: string;
};

export type StructuralGraphNode =
  | (GraphNodeBase & { kind: 'start' })
  | (GraphNodeBase & { kind: 'end'; outcome?: EndOutcome });

export type StepGraphNode = GraphNodeBase & {
  kind: 'step';
  executor: StepExecutor;
  /** A gate is a Step modifier, distinct from human executor ownership. */
  hitl?: HitlConfig;
  /** The policy is independent from HITL; its presence renders Sensitive. */
  sensitive?: SensitiveEffectPolicy;
  participation?: StepParticipation;
  /** Canonical v5 direct Store access; summaries are derived for compatibility. */
  storeAccess?: StepStoreAccess;
  /** Canonical v5 retry policy; it never creates a routing edge. */
  retry?: RetryPolicy;
  /** Canonical v6 readiness; modifier summaries remain compatibility projections. */
  readiness?: StepReadiness;
  /** Declared prebuilt boundary only; it never contains inferred children. */
  opaque?: OpaqueStepMetadata;
  modifiers?: StepModifierSummary;
};

export type MergeConfig = {
  reducer: { name: string; aggregateState: string };
  completion: { mode: 'all' | 'any' | 'quorum'; quorum?: number };
  continuation: { mode: 'once' | 'per_batch' };
  waitingForDynamicInputs: true;
};

/** A Merge is a structural junction, never a work Step or palette preset. */
export type MergeGraphNode = GraphNodeBase & {
  kind: 'merge';
  merge: MergeConfig;
};

/** v4 persistence nodes include Merge but predate v5 durability fields. */
export type StepGraphNodeV4 = Omit<StepGraphNode, 'storeAccess' | 'retry'>;
export type GraphNodeV4 = StructuralGraphNode | StepGraphNodeV4 | MergeGraphNode;

/** v3 persistence nodes deliberately predate Merge and v5 durability fields. */
export type GraphNodeV3 = StructuralGraphNode | StepGraphNodeV4;

/** The active, serialized node model. Agent/Action/Tool/Human are presets, not kinds. */
export type GraphNode = StructuralGraphNode | StepGraphNode | MergeGraphNode;

export type StepGraphNodeV2 = Omit<
  StepGraphNode,
  'hitl' | 'sensitive' | 'storeAccess' | 'retry' | 'modifiers'
> & {
  hitl?: HitlConfigV2;
  modifiers?: StepModifierSummaryV2;
};
export type GraphNodeV2 = StructuralGraphNode | StepGraphNodeV2;

/** The v1 persistence-only node shape. Never use this for new writes. */
export type LegacyGraphNodeV1 = GraphNodeBase & {
  kind: V1NodeKind;
  hitl?: HitlConfigV2;
};

export type SendMapConfig = {
  /** The one canonical template worker; must equal the edge target. */
  destinationTemplateId: string;
  multiplicity: 'dynamic';
  payloadLabel: string;
  mergeNodeId: string;
  payloadSchemaRef?: string;
};

type GraphEdgeIdentity = {
  id: string;
  source: string;
  target: string;
  label?: string;
  provenance?: Provenance;
};

type RoutingGraphEdgeBase = GraphEdgeIdentity & {
  mode: RoutingEdgeMode;
  condition?: string;
};

export type RoutingGraphEdge = RoutingGraphEdgeBase & {
  send?: never;
  /** A cap only has meaning on a topology-derived return edge. */
  loopCap?: number;
};

export type SendGraphEdge = GraphEdgeIdentity & {
  mode: 'send';
  condition?: never;
  send: SendMapConfig;
  /** A cap only has meaning on a topology-derived return edge. */
  loopCap?: number;
};

/** Active v4 edge. Send and routing modes are mutually exclusive by type. */
export type GraphEdge = RoutingGraphEdge | SendGraphEdge;

/** v3 edge shape accepted only by the persistence migration. */
export type GraphEdgeV3 = RoutingGraphEdgeBase;

export type RelationshipEndpoint =
  | { kind: 'node'; nodeId: string }
  | { kind: 'external'; externalId: string; label: string };

export type NonNativeRelationshipKind =
  | 'spawned-run'
  | 'spawned-thread'
  | 'external-orchestration';

/**
 * A system boundary relationship is intentionally not a GraphEdge. It can
 * leave the compiled graph or re-enter it but is excluded from every native
 * routing, proxy, reachability, loop, and DFS operation.
 */
export type NonNativeRelationship = {
  id: string;
  kind: NonNativeRelationshipKind;
  source: RelationshipEndpoint;
  target: RelationshipEndpoint;
  label?: string;
  provenance: Provenance;
};

/** Native-edge truth is derived from the collection/type, never persisted. */
export const isNativeControlEdge = (
  relationship: GraphEdge | NonNativeRelationship,
): relationship is GraphEdge => 'mode' in relationship;

const normalizedRouteText = (value: string | undefined) => value?.trim();

/**
 * Keeps persisted routing data compatible with the edge's role. This is the
 * one canonical boundary used by editor writes, proposals, persistence, and
 * exports; presentation code must not merely hide incompatible fields.
 */
export function normalizeRoutingEdge<T extends GraphEdge | GraphEdgeV3>(edge: T): T {
  const { mode, label, condition, send, loopCap, ...identity } = edge as GraphEdge;
  const normalizedLabel = normalizedRouteText(label);
  const normalizedLoopCap = loopCap === undefined ? {} : { loopCap };

  if (mode === 'send') {
    return {
      ...identity,
      mode,
      ...(normalizedLabel ? { label: normalizedLabel } : {}),
      ...normalizedLoopCap,
      ...(send
        ? {
            send: {
              ...send,
              destinationTemplateId: send.destinationTemplateId.trim(),
              payloadLabel: send.payloadLabel.trim(),
              mergeNodeId: send.mergeNodeId.trim(),
              ...(send.payloadSchemaRef !== undefined
                ? { payloadSchemaRef: send.payloadSchemaRef.trim() }
                : {}),
            },
          }
        : {}),
    } as T;
  }

  if (mode === 'normal') {
    return { ...identity, mode, ...normalizedLoopCap, ...(normalizedLabel ? { label: normalizedLabel } : {}) } as T;
  }
  if (mode === 'fallback') {
    return { ...identity, mode, ...normalizedLoopCap, label: 'fallback' } as T;
  }

  return {
    ...identity,
    mode,
    ...normalizedLoopCap,
    ...(normalizedLabel !== undefined ? { label: normalizedLabel } : {}),
    ...(condition !== undefined ? { condition: normalizedRouteText(condition) } : {}),
  } as T;
}

/** Returns a graph copy whose route semantics are safe to persist or export. */
export function normalizeWorkflowGraphRouting<T extends { edges: Array<GraphEdge | GraphEdgeV3> }>(graph: T): T {
  return { ...graph, edges: graph.edges.map(normalizeRoutingEdge) };
}

/** Explicit v5 defaults for new graphs and pre-capability migrations. */
export function createDefaultGraphCapabilities(): GraphCapabilities {
  return {
    state: { enabled: false, schema: { fields: [] }, reducers: [] },
    checkpointer: { enabled: false, durableThread: { required: false } },
    store: { available: false },
    runtimeMode: { mode: 'unspecified' },
    provenance: {
      evidenceOverlayAvailable: true,
      externalOrchestrationAvailable: false,
    },
  };
}

const legacyRetryPolicy = (): RetryPolicy => ({
  maxAttempts: 2,
  backoff: { strategy: 'fixed', initialDelayMs: 0 },
});

/**
 * v5 treats Step access and retry as the source of truth. Older compact
 * modifier flags are accepted at the boundary and regenerated from that
 * canonical data so existing presentation consumers remain compatible.
 */
export function normalizeStepDurability(node: StepGraphNode): StepGraphNode {
  const {
    storeRead,
    storeWrite,
    retryFallback,
    opaque: legacyOpaque,
    readiness: legacyReadiness,
    ...remainingModifiers
  } = node.modifiers ?? {};
  const storeAccess = node.storeAccess ?? {
    ...(storeRead ? { read: {} } : {}),
    ...(storeWrite ? { write: {} } : {}),
  };
  const retry = node.retry ?? (retryFallback ? legacyRetryPolicy() : undefined);
  const modifiers = {
    ...remainingModifiers,
    ...(storeAccess.read ? { storeRead: true as const } : {}),
    ...(storeAccess.write ? { storeWrite: true as const } : {}),
    ...(retry ? { retryFallback: true as const } : {}),
    ...(node.opaque || legacyOpaque ? { opaque: true as const } : {}),
    ...((node.readiness?.state ?? legacyReadiness) &&
    (node.readiness?.state ?? legacyReadiness) !== 'ready'
      ? { readiness: (node.readiness?.state ?? legacyReadiness) as 'degraded' | 'unimplemented' }
      : {}),
  };

  return {
    ...node,
    ...(node.storeAccess !== undefined || storeAccess.read || storeAccess.write ? { storeAccess } : {}),
    ...(retry ? { retry } : {}),
    readiness: node.readiness ?? { state: legacyReadiness ?? 'ready' },
    ...(Object.keys(modifiers).length > 0 ? { modifiers } : {}),
  };
}

type WorkflowGraphBase<
  Edge extends GraphEdge | GraphEdgeV3 = GraphEdge,
  Subgraph extends GraphSubgraphBase = GraphSubgraph,
> = {
  id: string;
  name: string;
  edges: Edge[];
  subgraphs: Subgraph[];
  status: 'draft' | 'frozen';
  updatedAt: string;
};

/** v5 is persistence input only and predates provenance relationships. */
export type GraphCapabilitiesV5 = Omit<GraphCapabilities, 'provenance'>;

export type WorkflowGraphV5 = WorkflowGraphBase & {
  schemaVersion: '5';
  nodes: GraphNode[];
  capabilities: GraphCapabilitiesV5;
};

/** The active, serialized schema. All new writes use v6. */
export type WorkflowGraph = WorkflowGraphBase & {
  schemaVersion: '6';
  nodes: GraphNode[];
  capabilities: GraphCapabilities;
  /** Separate from edges so system boundaries can never become native control. */
  relationships: NonNativeRelationship[];
};

/** v4 is persistence input only and is normalized before it reaches v5. */
export type WorkflowGraphV4 = WorkflowGraphBase<GraphEdge, GraphSubgraphV4> & {
  schemaVersion: '4';
  nodes: GraphNodeV4[];
};

/** v3 is persistence input only and is normalized before it reaches v4. */
export type WorkflowGraphV3 = WorkflowGraphBase<GraphEdgeV3, GraphSubgraphV4> & {
  schemaVersion: '3';
  nodes: GraphNodeV3[];
};

/** v2 is persistence input only and is normalized before it reaches v4. */
export type WorkflowGraphV2 = WorkflowGraphBase<GraphEdgeV3, GraphSubgraphV4> & {
  schemaVersion: '2';
  nodes: GraphNodeV2[];
};

/** The v1 persistence-only graph shape accepted by the ordinary migration. */
export type WorkflowGraphV1 = WorkflowGraphBase<GraphEdgeV3, GraphSubgraphV4> & {
  schemaVersion: '1';
  nodes: LegacyGraphNodeV1[];
};

/**
 * Resolves one scope without mutating the graph. A graph-level request is
 * marked `graph`; a subgraph inherits each unsupported/absent override.
 */
export function resolveEffectiveCapabilities(
  graph: Pick<WorkflowGraph, 'capabilities' | 'subgraphs'>,
  subgraphId?: string,
): EffectiveGraphCapabilities {
  const subgraph = subgraphId
    ? graph.subgraphs.find((candidate) => candidate.id === subgraphId)
    : undefined;
  const overrides = subgraph?.capabilityOverrides;
  const resolve = <T,>(value: T, override: T | undefined): EffectiveCapability<T> =>
    override !== undefined
      ? { source: 'overridden', value: override }
      : { source: subgraph ? 'inherited' : 'graph', value };

  return {
    state: resolve(graph.capabilities.state, overrides?.state),
    checkpointer: resolve(graph.capabilities.checkpointer, overrides?.checkpointer),
    store: resolve(graph.capabilities.store, overrides?.store),
    runtimeMode: { source: 'graph', value: graph.capabilities.runtimeMode },
  };
}

export function normalizeLegacyEndOutcome(label: string): EndOutcome {
  const normalized = label.trim().toLocaleLowerCase();
  if (/(await|reply|response|input|end of turn|turn complete)/u.test(normalized)) {
    return { kind: 'awaiting-reply' };
  }
  if (/(fail|error|reject|declin|dead.?letter|dlq)/u.test(normalized)) {
    return { kind: 'failure' };
  }
  if (/(partial|incomplete)/u.test(normalized)) return { kind: 'partial-result' };
  if (/(cancel|abort|stop)/u.test(normalized)) return { kind: 'cancelled' };
  return { kind: 'completed' };
}

const declaredProvenance = (): Provenance => ({ representation: 'declared' });

/** Canonicalizes route fields and v5/v6 compatibility summaries for writes. */
export function normalizeWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  return normalizeWorkflowGraphRouting({
    ...graph,
    capabilities: {
      ...graph.capabilities,
      provenance: graph.capabilities.provenance ?? createDefaultGraphCapabilities().provenance,
    },
    nodes: graph.nodes.map((node) =>
      node.kind === 'step'
        ? { ...normalizeStepDurability(node), provenance: node.provenance ?? declaredProvenance() }
        : node.kind === 'end'
          ? {
              ...node,
              outcome: node.outcome ?? normalizeLegacyEndOutcome(node.label),
              provenance: node.provenance ?? declaredProvenance(),
            }
          : { ...node, provenance: node.provenance ?? declaredProvenance() },
    ),
    edges: graph.edges.map((edge) => ({ ...edge, provenance: edge.provenance ?? declaredProvenance() })),
    relationships: (graph.relationships ?? []).map((relationship) => ({
      ...relationship,
      provenance: relationship.provenance ?? declaredProvenance(),
    })),
  });
}

/** Deliberately excludes `kind`; active node identity never changes in-place. */
export type GraphNodePatch = Partial<
  Omit<GraphNodeBase, 'id' | 'parentId'> & {
    hitl: HitlConfig;
    /** `null` is patch-only and removes the optional sensitive-effect policy. */
    sensitive: SensitiveEffectPolicy | null;
    executor: StepExecutor;
    participation: StepParticipation;
    /** `null` removes direct Store access from a Step. */
    storeAccess: StepStoreAccess | null;
    /** `null` removes the internal retry policy from a Step. */
    retry: RetryPolicy | null;
    readiness: StepReadiness;
    /** `null` removes an opaque/prebuilt declaration from a Step. */
    opaque: OpaqueStepMetadata | null;
    outcome: EndOutcome;
    modifiers: StepModifierSummary;
    merge: MergeConfig;
  }
>;

/** Patch shape stays explicit because GraphEdge is a discriminated union. */
export type GraphEdgePatch = {
  source?: string;
  target?: string;
  mode?: EdgeMode;
  label?: string;
  condition?: string;
  send?: SendMapConfig;
  loopCap?: number;
  provenance?: Provenance;
};

export type NonNativeRelationshipPatch = Partial<
  Pick<NonNativeRelationship, 'kind' | 'source' | 'target' | 'label' | 'provenance'>
>;

const legacyExecutorByKind: Record<LegacyNodeKind, StepExecutor> = {
  agent: 'ai',
  action: 'deterministic',
  tool: 'tool',
  human_input: 'human',
};

const hasConfiguredInternalTools = (config: Record<string, unknown> | undefined) =>
  Array.isArray(config?.tools) && config.tools.length > 0;

/** Converts one legacy work-node kind into its normalized Step identity. */
export function normalizeLegacyWorkNodeKind(
  kind: LegacyNodeKind,
  config?: Record<string, unknown>,
): Pick<StepGraphNode, 'kind' | 'executor' | 'participation'> {
  return {
    kind: 'step',
    executor: legacyExecutorByKind[kind],
    ...(kind === 'agent' && hasConfiguredInternalTools(config)
      ? { participation: { internalTools: true } }
      : {}),
  };
}

/** Converts one v1 node into its v2-normalized Step identity. */
export function migrateLegacyGraphNodeV1(node: LegacyGraphNodeV1): GraphNodeV2 {
  if (node.kind === 'start' || node.kind === 'end') return { ...node } as StructuralGraphNode;

  const { kind, ...step } = node;
  return { ...step, ...normalizeLegacyWorkNodeKind(kind, step.config) };
}

/**
 * Converts a persisted v1 graph into the v2 normalization input. v1 always
 * passes through this seam before the v3 migration below.
 */
export function migrateWorkflowGraphV1(graph: WorkflowGraphV1): WorkflowGraphV2 {
  return normalizeWorkflowGraphRouting({
    ...graph,
    schemaVersion: '2',
    nodes: graph.nodes.map(migrateLegacyGraphNodeV1),
  });
}

const legacyOutcomeId = (edge: GraphEdge) => `outcome:${edge.id}`;

const legacyOutcomeLabel = (edge: GraphEdge, nodes: readonly GraphNodeV2[]) =>
  edge.label?.trim() || nodes.find((node) => node.id === edge.target)?.label || edge.target;

/**
 * v2 HITL had no response destinations. Derive deterministic migration
 * defaults from existing canonical edges, never by adding or rewiring an edge.
 * Empty draft edge sets stay empty so ordinary validation can report them.
 */
export function migrateHitlConfigV2(
  hitl: HitlConfigV2 | undefined,
  nodeId: string,
  graph: Pick<WorkflowGraphV2, 'nodes' | 'edges'>,
): HitlConfig | undefined {
  if (!hitl) return undefined;
  if (!hitl.enabled) return { enabled: false };

  const type = hitl.inputType ?? 'approval';
  const outgoing = graph.edges.filter((edge) => edge.source === nodeId);
  const allowedOutcomes = outgoing.map((edge) => ({
    id: legacyOutcomeId(edge),
    label: legacyOutcomeLabel(edge, graph.nodes),
    resumeNodeId: edge.target,
  }));
  const selectionChoices =
    type === 'selection'
      ? allowedOutcomes.map(({ id, label }) => ({ id, label }))
      : undefined;
  const reason = hitl.condition?.trim();

  return {
    enabled: true,
    timing: hitl.timing === 'conditional' ? 'inside' : hitl.timing ?? 'before',
    response: { type, allowedOutcomes, ...(selectionChoices ? { selectionChoices } : {}) },
    ...(reason ? { activation: { reason } } : {}),
  };
}

export const legacySensitiveEffectPolicy: SensitiveEffectPolicy = {
  target: 'Legacy sensitive side effect',
  authorization: 'Legacy authorization not specified',
  approvalRequired: false,
  idempotency: 'Legacy idempotency not specified',
};

/** Migrates a v2 node without discarding incomplete draft configuration. */
export function migrateGraphNodeV2(node: GraphNodeV2, graph: WorkflowGraphV2): GraphNodeV3 {
  if (node.kind !== 'step') return { ...node };
  const { hitl, modifiers, ...step } = node;
  const { sensitiveSideEffect, ...remainingModifiers } = modifiers ?? {};
  const migratedHitl = migrateHitlConfigV2(hitl, node.id, graph);
  return {
    ...step,
    ...(Object.keys(remainingModifiers).length > 0 ? { modifiers: remainingModifiers } : {}),
    ...(sensitiveSideEffect ? { sensitive: { ...legacySensitiveEffectPolicy } } : {}),
    ...(migratedHitl ? { hitl: migratedHitl } : {}),
  };
}

/**
 * Converts a v2 graph into v3 input shape. It intentionally does not validate
 * topology, so parseable partial drafts retain their authored state.
 */
export function migrateWorkflowGraphV2ToV3(graph: WorkflowGraphV2): WorkflowGraphV3 {
  return normalizeWorkflowGraphRouting({
    ...graph,
    schemaVersion: '3',
    nodes: graph.nodes.map((node) => migrateGraphNodeV2(node, graph)),
  });
}

/**
 * Advances a valid v3 graph into the Package 3 v4 shape without changing
 * topology, labels, positions, policies, or proposal meaning.
 */
export function migrateWorkflowGraphV3ToV4(graph: WorkflowGraphV3): WorkflowGraphV4 {
  return normalizeWorkflowGraphRouting({
    ...graph,
    schemaVersion: '4',
    nodes: graph.nodes.map((node) => ({ ...node })),
  });
}

/** Adds v5 capability records without changing legacy topology. */
export function migrateWorkflowGraphV4ToV5(graph: WorkflowGraphV4): WorkflowGraphV5 {
  const defaults = createDefaultGraphCapabilities();
  const capabilities: GraphCapabilitiesV5 = {
    state: defaults.state,
    checkpointer: defaults.checkpointer,
    store: defaults.store,
    runtimeMode: defaults.runtimeMode,
  };
  if (
    graph.nodes.some(
      (node) =>
        node.kind === 'step' &&
        (node.modifiers?.storeRead === true || node.modifiers?.storeWrite === true),
    )
  ) {
    capabilities.store.available = true;
  }
  return normalizeWorkflowGraphRouting({
    ...graph,
    schemaVersion: '5',
    capabilities,
    nodes: graph.nodes.map((node) =>
      node.kind === 'step' ? normalizeStepDurability({ ...node }) : { ...node },
    ),
  });
}

/**
 * v5 authored elements become declared v6 elements. This transition does not
 * invent evidence, runtime inspection, relationships, or confidence claims.
 */
export function migrateGraphNodeV5(node: GraphNode): GraphNode {
  if (node.kind === 'step') {
    return {
      ...normalizeStepDurability(node),
      provenance: node.provenance ?? declaredProvenance(),
    };
  }
  if (node.kind === 'end') {
    return {
      ...node,
      outcome: node.outcome ?? normalizeLegacyEndOutcome(node.label),
      provenance: node.provenance ?? declaredProvenance(),
    };
  }
  return { ...node, provenance: node.provenance ?? declaredProvenance() };
}

export function migrateGraphEdgeV5(edge: GraphEdge): GraphEdge {
  return { ...edge, provenance: edge.provenance ?? declaredProvenance() };
}

export function migrateWorkflowGraphV5(graph: WorkflowGraphV5): WorkflowGraph {
  return normalizeWorkflowGraph({
    ...graph,
    schemaVersion: '6',
    capabilities: {
      ...graph.capabilities,
      provenance: createDefaultGraphCapabilities().provenance,
    },
    nodes: graph.nodes.map(migrateGraphNodeV5),
    edges: graph.edges.map(migrateGraphEdgeV5),
    relationships: [],
  });
}

/** Converts v4 persistence input directly into the active v6 graph. */
export function migrateWorkflowGraphV4(graph: WorkflowGraphV4): WorkflowGraph {
  return migrateWorkflowGraphV5(migrateWorkflowGraphV4ToV5(graph));
}

/** Converts v3 persistence input directly into the active v6 graph. */
export function migrateWorkflowGraphV3(graph: WorkflowGraphV3): WorkflowGraph {
  return migrateWorkflowGraphV4(migrateWorkflowGraphV3ToV4(graph));
}

/** Converts v2 persistence input directly into the active v6 graph. */
export function migrateWorkflowGraphV2(graph: WorkflowGraphV2): WorkflowGraph {
  return migrateWorkflowGraphV3(migrateWorkflowGraphV2ToV3(graph));
}

/** Convenience migration for callers that receive an original v1 payload. */
export function migrateWorkflowGraphV1ToV6(graph: WorkflowGraphV1): WorkflowGraph {
  return migrateWorkflowGraphV2(migrateWorkflowGraphV1(graph));
}

/** Compatibility names retained for callers from prior package revisions. */
export const migrateWorkflowGraphV1ToV5 = migrateWorkflowGraphV1ToV6;
export const migrateWorkflowGraphV1ToV4 = migrateWorkflowGraphV1ToV6;
export const migrateWorkflowGraphV1ToV3 = migrateWorkflowGraphV1ToV6;

export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type GraphOperation =
  | { type: 'add_node'; node: GraphNode }
  | {
      type: 'update_node';
      nodeId: string;
      patch: GraphNodePatch;
    }
  | { type: 'remove_node'; nodeId: string }
  | { type: 'add_subgraph'; subgraph: GraphSubgraph }
  | {
      type: 'update_subgraph';
      subgraphId: string;
      patch: Partial<Omit<GraphSubgraph, 'id'>>;
    }
  | { type: 'update_graph_capabilities'; patch: GraphCapabilitiesPatch }
  | {
      type: 'set_subgraph_capability_override';
      subgraphId: string;
      /** Exactly one supported capability record; it replaces that override. */
      override: GraphCapabilityOverrides;
    }
  | {
      type: 'remove_subgraph_capability_override';
      subgraphId: string;
      capability: keyof GraphCapabilityOverrides;
    }
  | { type: 'assign_nodes_to_subgraph'; subgraphId: string; nodeIds: string[] }
  | { type: 'remove_nodes_from_subgraph'; nodeIds: string[] }
  | { type: 'dissolve_subgraph'; subgraphId: string }
  | { type: 'add_edge'; edge: GraphEdge }
  | {
      type: 'update_edge';
      edgeId: string;
      patch: GraphEdgePatch;
    }
  | { type: 'remove_edge'; edgeId: string }
  | { type: 'add_relationship'; relationship: NonNativeRelationship }
  | {
      type: 'update_relationship';
      relationshipId: string;
      patch: NonNativeRelationshipPatch;
    }
  | { type: 'remove_relationship'; relationshipId: string };

export type ProposalDiff = {
  addedNodeIds: string[];
  updatedNodeIds: string[];
  removedNodeIds: string[];
  addedSubgraphIds: string[];
  updatedSubgraphIds: string[];
  removedSubgraphIds: string[];
  membershipChangedNodeIds: string[];
  addedEdgeIds: string[];
  updatedEdgeIds: string[];
  removedEdgeIds: string[];
  addedRelationshipIds: string[];
  updatedRelationshipIds: string[];
  removedRelationshipIds: string[];
  /** Stable canonical paths for durability-scope changes. */
  changedCapabilityPaths: string[];
  /** Stable canonical paths for evidence/provenance changes. */
  changedProvenancePaths: string[];
  changedReadinessNodeIds: string[];
  changedOpaqueNodeIds: string[];
  changedEndOutcomeNodeIds: string[];
};

export type GraphProposal = {
  id: string;
  baseGraphId: string;
  baseUpdatedAt: string;
  operations: GraphOperation[];
  rationale: string;
  status: 'pending' | 'approved' | 'rejected' | 'invalid' | 'stale';
  createdAt: string;
  validationErrors?: ValidationIssue[];
  diff: ProposalDiff;
};

export type BranchCondition = {
  nodeId: string;
  nodeLabel: string;
  edgeId: string;
  mode: EdgeMode;
  label: string;
  condition?: string;
  isFallback?: boolean;
};

/** A graph edge as taken by one enumerated scenario path. */
export type ScenarioEdge = GraphEdge & {
  /** True when this connection returns to an ancestor in the graph topology. */
  isLoop?: boolean;
  isFallback?: boolean;
};

/** The configured response that selected an existing outgoing edge. */
export type ScenarioHumanOutcome = {
  nodeId: string;
  nodeLabel: string;
  timing: HitlTiming;
  responseType: HumanResponseType;
  outcomeId: string;
  outcomeLabel: string;
  resumeNodeId: string;
};

/** One design-time traversal of a dynamic map relationship; never N workers. */
export type ScenarioDynamicSend = {
  edgeId: string;
  sourceNodeId: string;
  templateNodeId: string;
  destinationTemplateId: string;
  multiplicity: 'dynamic';
  payloadLabel: string;
  mergeNodeId: string;
  payloadSchemaRef?: string;
};

/** Reducer metadata reached by a design-time scenario path. */
export type ScenarioMerge = {
  nodeId: string;
  reducer: MergeConfig['reducer'];
  completion: MergeConfig['completion'];
  continuation: MergeConfig['continuation'];
  waitingForDynamicInputs: true;
};

export type ScenarioRelationshipAnnotation =
  | {
      family: 'native-control';
      edgeId: string;
      source: string;
      target: string;
      mode: EdgeMode;
      provenance: Provenance;
    }
  | {
      family: 'spawned' | 'external-orchestration';
      relationshipId: string;
      kind: NonNativeRelationshipKind;
      source: RelationshipEndpoint;
      target: RelationshipEndpoint;
      provenance: Provenance;
    };

export type BranchScenario = {
  id: string;
  name: string;
  triggeringConditions: BranchCondition[];
  /** Ordered human responses are separate from authored routing conditions. */
  humanOutcomes: ScenarioHumanOutcome[];
  /** Ordered edges retain the authored routing data needed by scenario exports. */
  traversedEdges: ScenarioEdge[];
  /** Ordered dynamic maps are annotations, never fabricated worker paths. */
  dynamicSends: ScenarioDynamicSend[];
  /** Ordered Merge metadata follows the template path. */
  merges: ScenarioMerge[];
  /** Native paths plus related non-native boundary records; annotations never execute relationships. */
  relationshipAnnotations: ScenarioRelationshipAnnotation[];
  orderedPath: string[];
  expectedNodes: string[];
  expectedTerminalNode: string;
  expectedTerminalOutcome: EndOutcome;
};

export type RuntimeProjectionInstance = {
  id: string;
  sendEdgeId: string;
  templateNodeId: string;
  label?: string;
  ordinal: number;
};

/** Runtime evidence is projection-only and never part of WorkflowGraph. */
export type RuntimeProjectionFixture = {
  graphId: string;
  graphUpdatedAt: string;
  instances: RuntimeProjectionInstance[];
};

const positionSchema = z.object({ x: z.number(), y: z.number() });
const dimensionsSchema = z.object({ width: z.number().positive(), height: z.number().positive() });

const humanSelectionChoiceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

const humanOutcomeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    resumeNodeId: z.string().min(1),
  })
  .strict();

export const hitlResponseContractSchema = z
  .object({
    type: z.enum(['approval', 'text', 'selection']),
    selectionChoices: z.array(humanSelectionChoiceSchema).optional(),
    allowedOutcomes: z.array(humanOutcomeSchema),
  })
  .strict();

export const hitlSchema = z
  .object({
    enabled: z.boolean(),
    timing: z.enum(['before', 'inside', 'after']).optional(),
    response: hitlResponseContractSchema.optional(),
    activation: z.object({ reason: z.string().min(1).optional() }).strict().optional(),
  })
  .strict();

/** v2 persistence input only; this schema must not be used for new writes. */
export const hitlV2Schema = z.object({
  enabled: z.boolean(),
  timing: z.enum(['before', 'after', 'conditional']).optional(),
  inputType: z.enum(['approval', 'text', 'selection']).optional(),
  condition: z.string().optional(),
}).strict();

const graphNodeBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  position: positionSchema,
  parentId: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  provenance: z
    .object({
      representation: z.enum(provenanceRepresentations),
      evidence: z
        .object({
          source: z.string().min(1).max(512),
          evidenceClass: z.string().min(1).max(160),
          confidence: z.enum(['low', 'medium', 'high']),
          details: z.string().min(1).max(4_000).optional(),
          timestamp: z.string().datetime({ offset: true }).optional(),
        })
        .strict()
        .optional(),
    })
    .strict()
    .optional(),
});

export const provenanceEvidenceSchema = graphNodeBaseSchema.shape.provenance.unwrap().shape.evidence.unwrap();
export const provenanceSchema = graphNodeBaseSchema.shape.provenance.unwrap();

export const stepModifierSummarySchema = z
  .object({
    guardrail: z.literal(true).optional(),
    storeRead: z.literal(true).optional(),
    storeWrite: z.literal(true).optional(),
    retryFallback: z.literal(true).optional(),
    opaque: z.literal(true).optional(),
    readiness: z.enum(['degraded', 'unimplemented']).optional(),
  })
  .strict();

export const stepReadinessSchema = z
  .object({
    state: z.enum(['ready', 'degraded', 'unimplemented']),
    detail: z.string().max(2_000).optional(),
  })
  .strict();

export const opaqueInterfacePortSchema = z
  .object({ name: z.string().min(1).max(160), description: z.string().max(1_000).optional() })
  .strict();

export const runtimeInspectionAvailabilitySchema = z
  .object({ available: z.boolean(), evidence: provenanceEvidenceSchema.optional() })
  .strict();

export const opaqueStepMetadataSchema = z
  .object({
    factoryLabel: z.string().min(1).max(240),
    inputPorts: z.array(opaqueInterfacePortSchema).max(64),
    outputPorts: z.array(opaqueInterfacePortSchema).max(64),
    runtimeInspection: runtimeInspectionAvailabilitySchema,
  })
  .strict();

export const endOutcomeSchema = z
  .object({
    kind: z.enum([
      'completed',
      'awaiting-reply',
      'failure',
      'partial-result',
      'cancelled',
      'domain-specific',
    ]),
    detail: z.string().max(2_000).optional(),
  })
  .strict();

export const workingStateCapabilitySchema = z
  .object({
    enabled: z.boolean(),
    schema: z.object({ fields: z.array(z.string()), summary: z.string().optional() }).strict(),
    reducers: z.array(z.object({ key: z.string(), summary: z.string() }).strict()),
  })
  .strict();

export const checkpointerCapabilitySchema = z
  .object({
    enabled: z.boolean(),
    backend: z.string().optional(),
    durableThread: z.object({ required: z.boolean(), threadIdSource: z.string().optional() }).strict(),
  })
  .strict();

export const longTermStoreCapabilitySchema = z
  .object({
    available: z.boolean(),
    namespace: z.string().optional(),
    retention: z.string().optional(),
  })
  .strict();

export const runtimeModeCapabilitySchema = z
  .object({ mode: z.enum(['unspecified', 'text', 'voice']), input: z.enum(['text', 'audio']).optional() })
  .strict();

export const provenanceCapabilitiesSchema = z
  .object({
    evidenceOverlayAvailable: z.boolean(),
    externalOrchestrationAvailable: z.boolean(),
  })
  .strict();

export const graphCapabilitiesSchema = z
  .object({
    state: workingStateCapabilitySchema,
    checkpointer: checkpointerCapabilitySchema,
    store: longTermStoreCapabilitySchema,
    runtimeMode: runtimeModeCapabilitySchema,
    provenance: provenanceCapabilitiesSchema.default({
      evidenceOverlayAvailable: true,
      externalOrchestrationAvailable: false,
    }),
  })
  .strict();

export const graphCapabilitiesV5Schema = graphCapabilitiesSchema.omit({ provenance: true });

export const graphCapabilitiesPatchSchema = z
  .object({
    state: workingStateCapabilitySchema.optional(),
    checkpointer: checkpointerCapabilitySchema.optional(),
    store: longTermStoreCapabilitySchema.optional(),
    runtimeMode: runtimeModeCapabilitySchema.optional(),
    provenance: provenanceCapabilitiesSchema.optional(),
  })
  .strict();

export const graphCapabilityOverridesSchema = graphCapabilitiesSchema
  .pick({ state: true, checkpointer: true, store: true })
  .partial()
  .strict();

const singleGraphCapabilityOverrideSchema = z.union([
  z.object({ state: workingStateCapabilitySchema }).strict(),
  z.object({ checkpointer: checkpointerCapabilitySchema }).strict(),
  z.object({ store: longTermStoreCapabilitySchema }).strict(),
]);

export const stepStoreAccessSchema = z
  .object({
    read: z.object({ namespace: z.string().optional(), key: z.string().optional() }).strict().optional(),
    write: z.object({ namespace: z.string().optional(), key: z.string().optional(), retention: z.string().optional() }).strict().optional(),
  })
  .strict();

export const retryPolicySchema = z
  .object({
    maxAttempts: z.number().int().optional(),
    backoff: z
      .object({
        strategy: z.enum(['fixed', 'exponential']).optional(),
        initialDelayMs: z.number().int().optional(),
        maxDelayMs: z.number().int().optional(),
      })
      .strict()
      .optional(),
    retryOn: z.array(z.string()).optional(),
    fallback: z.object({ provider: z.string().optional(), model: z.string().optional() }).strict().optional(),
  })
  .strict();

const stepModifierSummaryV2Schema = stepModifierSummarySchema.extend({
  sensitiveSideEffect: z.literal(true).optional(),
});

export const stepParticipationSchema = z
  .object({ internalTools: z.literal(true).optional() })
  .strict();

const stepExecutorSchema = z.enum(['deterministic', 'ai', 'tool', 'human']);

export const sensitiveEffectPolicySchema = z
  .object({
    target: z.string().min(1),
    authorization: z.string().min(1),
    approvalRequired: z.boolean(),
    idempotency: z.string().min(1),
  })
  .strict();

export const mergeConfigSchema = z
  .object({
    reducer: z
      .object({
        // Draft fields remain parseable while the inspector is being edited;
        // validateGraph owns the actionable readability requirements.
        name: z.string(),
        aggregateState: z.string(),
      })
      .strict(),
    completion: z
      .object({
        mode: z.enum(['all', 'any', 'quorum']),
        quorum: z.number().int().positive().optional(),
      })
      .strict(),
    continuation: z.object({ mode: z.enum(['once', 'per_batch']) }).strict(),
    waitingForDynamicInputs: z.literal(true),
  })
  .strict();

export const graphNodeSchema = z.discriminatedUnion('kind', [
  graphNodeBaseSchema.extend({ kind: z.literal('start') }).strict(),
  graphNodeBaseSchema.extend({
    kind: z.literal('step'),
    executor: stepExecutorSchema,
    hitl: hitlSchema.optional(),
    sensitive: sensitiveEffectPolicySchema.optional(),
    participation: stepParticipationSchema.optional(),
    storeAccess: stepStoreAccessSchema.optional(),
    retry: retryPolicySchema.optional(),
    readiness: stepReadinessSchema.optional(),
    opaque: opaqueStepMetadataSchema.optional(),
    modifiers: stepModifierSummarySchema.optional(),
  }).strict(),
  graphNodeBaseSchema.extend({ kind: z.literal('merge'), merge: mergeConfigSchema }).strict(),
  graphNodeBaseSchema.extend({ kind: z.literal('end'), outcome: endOutcomeSchema.optional() }).strict(),
]);

/** v4 input-only nodes deliberately omit v5 Step durability fields. */
const graphNodeV4StepSchema = graphNodeBaseSchema.extend({
  kind: z.literal('step'),
  executor: stepExecutorSchema,
  hitl: hitlSchema.optional(),
  sensitive: sensitiveEffectPolicySchema.optional(),
  participation: stepParticipationSchema.optional(),
  modifiers: stepModifierSummarySchema.optional(),
}).strict();

export const graphNodeV4Schema = z.discriminatedUnion('kind', [
  graphNodeBaseSchema.extend({ kind: z.literal('start') }).strict(),
  graphNodeV4StepSchema,
  graphNodeBaseSchema.extend({ kind: z.literal('merge'), merge: mergeConfigSchema }).strict(),
  graphNodeBaseSchema.extend({ kind: z.literal('end') }).strict(),
]);

/** v3 input-only nodes deliberately omit Package 3 Merge and v5 durability. */
export const graphNodeV3Schema = z.discriminatedUnion('kind', [
  graphNodeBaseSchema.extend({ kind: z.literal('start') }).strict(),
  graphNodeV4StepSchema,
  graphNodeBaseSchema.extend({ kind: z.literal('end') }).strict(),
]);

/** v2 compatibility input only; active graph operations never accept this shape. */
export const graphNodeV2Schema = z.discriminatedUnion('kind', [
  graphNodeBaseSchema.extend({ kind: z.literal('start') }).strict(),
  graphNodeBaseSchema.extend({
    kind: z.literal('step'),
    executor: stepExecutorSchema,
    hitl: hitlV2Schema.optional(),
    participation: stepParticipationSchema.optional(),
    modifiers: stepModifierSummaryV2Schema.optional(),
  }).strict(),
  graphNodeBaseSchema.extend({ kind: z.literal('end') }).strict(),
]);

/** v1 compatibility input only; successful parsing must be followed by migration. */
export const legacyGraphNodeV1Schema = graphNodeBaseSchema.extend({
  kind: z.enum(v1NodeKinds),
  hitl: hitlV2Schema.optional(),
}).strict();

const graphSubgraphBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  position: positionSchema,
  dimensions: dimensionsSchema,
  collapsed: z.boolean(),
}).strict();

/** v1-v4 containers must not accept v5 durability override metadata. */
export const graphSubgraphV4Schema = graphSubgraphBaseSchema;

export const graphSubgraphSchema = graphSubgraphBaseSchema.extend({
  capabilityOverrides: graphCapabilityOverridesSchema.optional(),
}).strict();

const graphEdgeBaseSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  condition: z.string().optional(),
  loopCap: z.number().int().min(1).max(10).optional(),
  provenance: provenanceSchema.optional(),
});

export const sendMapConfigSchema = z
  .object({
    // Draft configuration must survive persistence even before it is valid.
    destinationTemplateId: z.string(),
    multiplicity: z.literal('dynamic'),
    payloadLabel: z.string(),
    mergeNodeId: z.string(),
    payloadSchemaRef: z.string().optional(),
  })
  .strict();

const routingGraphEdgeSchema = (mode: RoutingEdgeMode) =>
  graphEdgeBaseSchema.extend({ mode: z.literal(mode), send: z.never().optional() }).strict();

export const graphEdgeSchema = z.discriminatedUnion('mode', [
  routingGraphEdgeSchema('normal'),
  routingGraphEdgeSchema('conditional'),
  routingGraphEdgeSchema('command'),
  routingGraphEdgeSchema('fallback'),
  graphEdgeBaseSchema
    .omit({ condition: true })
    .extend({ mode: z.literal('send'), send: sendMapConfigSchema })
    .strict(),
]);

/** v3 input-only edges deliberately omit Send and loop caps. */
export const graphEdgeV3Schema = graphEdgeBaseSchema
  .omit({ loopCap: true, provenance: true })
  .extend({ mode: z.enum(['normal', 'conditional', 'command', 'fallback']) });

export const relationshipEndpointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('external'),
      externalId: z.string().min(1).max(240),
      label: z.string().min(1).max(240),
    })
    .strict(),
]);

export const nonNativeRelationshipSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['spawned-run', 'spawned-thread', 'external-orchestration']),
    source: relationshipEndpointSchema,
    target: relationshipEndpointSchema,
    label: z.string().max(512).optional(),
    provenance: provenanceSchema,
  })
  .strict();

const workflowGraphCoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['draft', 'frozen']),
  updatedAt: z.string().min(1),
});

const workflowGraphV5BaseSchema = workflowGraphCoreSchema.extend({
  subgraphs: z.array(graphSubgraphSchema).default([]),
}).strict();

const workflowGraphV4BaseSchema = workflowGraphCoreSchema.extend({
  // A default keeps every pre-subgraph persisted graph readable without
  // changing its node positions, topology, or other authored data.
  subgraphs: z.array(graphSubgraphV4Schema).default([]),
}).strict();

export const workflowGraphSchema = workflowGraphV5BaseSchema.extend({
  schemaVersion: z.literal('6'),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  capabilities: graphCapabilitiesSchema,
  relationships: z.array(nonNativeRelationshipSchema).default([]),
}).strict();

/** v5 compatibility input only; successful parsing must be followed by migration. */
export const workflowGraphV5Schema = workflowGraphV5BaseSchema.extend({
  schemaVersion: z.literal('5'),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  capabilities: graphCapabilitiesV5Schema,
}).strict();

/** v4 compatibility input only; successful parsing must be followed by migration. */
export const workflowGraphV4Schema = workflowGraphV4BaseSchema.extend({
  schemaVersion: z.literal('4'),
  nodes: z.array(graphNodeV4Schema),
  edges: z.array(graphEdgeSchema),
}).strict();

/** v3 compatibility input only; successful parsing must be followed by migration. */
export const workflowGraphV3Schema = workflowGraphV4BaseSchema.extend({
  schemaVersion: z.literal('3'),
  nodes: z.array(graphNodeV3Schema),
  edges: z.array(graphEdgeV3Schema),
}).strict();

/** v2 compatibility input only; successful parsing must be followed by migration. */
export const workflowGraphV2Schema = workflowGraphV3Schema
  .omit({ schemaVersion: true, nodes: true })
  .extend({
    schemaVersion: z.literal('2'),
    nodes: z.array(graphNodeV2Schema),
  })
  .strict();

/** v1 compatibility input only; active graph operations never accept this shape. */
export const workflowGraphV1Schema = workflowGraphV2Schema
  .omit({ schemaVersion: true, nodes: true })
  .extend({
    schemaVersion: z.literal('1'),
    nodes: z.array(legacyGraphNodeV1Schema),
  })
  .strict();

export const graphNodePatchSchema = z
  .object({
    label: z.string().min(1).optional(),
    description: z.string().optional(),
    position: positionSchema.optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    hitl: hitlSchema.optional(),
    sensitive: sensitiveEffectPolicySchema.nullable().optional(),
    executor: stepExecutorSchema.optional(),
    participation: stepParticipationSchema.optional(),
    storeAccess: stepStoreAccessSchema.nullable().optional(),
    retry: retryPolicySchema.nullable().optional(),
    readiness: stepReadinessSchema.optional(),
    opaque: opaqueStepMetadataSchema.nullable().optional(),
    outcome: endOutcomeSchema.optional(),
    modifiers: stepModifierSummarySchema.optional(),
    merge: mergeConfigSchema.optional(),
    provenance: provenanceSchema.optional(),
  })
  .strict();

export const graphEdgePatchSchema = z
  .object({
    source: z.string().min(1).optional(),
    target: z.string().min(1).optional(),
    mode: z.enum(['normal', 'conditional', 'command', 'fallback', 'send']).optional(),
    label: z.string().optional(),
    condition: z.string().optional(),
    send: sendMapConfigSchema.optional(),
    loopCap: z.number().int().min(1).max(10).optional(),
    provenance: provenanceSchema.optional(),
  })
  .strict();

export const nonNativeRelationshipPatchSchema = nonNativeRelationshipSchema
  .omit({ id: true })
  .partial()
  .strict();

export const runtimeProjectionFixtureSchema = z
  .object({
    graphId: z.string().min(1),
    graphUpdatedAt: z.string().min(1),
    instances: z.array(
      z
        .object({
          id: z.string().min(1),
          sendEdgeId: z.string().min(1),
          templateNodeId: z.string().min(1),
          label: z.string().min(1).optional(),
          ordinal: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

export const graphOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_node'), node: graphNodeSchema }),
  z.object({
    type: z.literal('update_node'),
    nodeId: z.string().min(1),
    patch: graphNodePatchSchema,
  }),
  z.object({ type: z.literal('remove_node'), nodeId: z.string().min(1) }),
  z.object({ type: z.literal('add_subgraph'), subgraph: graphSubgraphSchema }),
  z.object({
    type: z.literal('update_subgraph'),
    subgraphId: z.string().min(1),
    patch: graphSubgraphSchema.omit({ id: true }).partial().strict(),
  }),
  z.object({
    type: z.literal('update_graph_capabilities'),
    patch: graphCapabilitiesPatchSchema,
  }),
  z.object({
    type: z.literal('set_subgraph_capability_override'),
    subgraphId: z.string().min(1),
    override: singleGraphCapabilityOverrideSchema,
  }),
  z.object({
    type: z.literal('remove_subgraph_capability_override'),
    subgraphId: z.string().min(1),
    capability: z.enum(['state', 'checkpointer', 'store']),
  }),
  z.object({
    type: z.literal('assign_nodes_to_subgraph'),
    subgraphId: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('remove_nodes_from_subgraph'),
    nodeIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({ type: z.literal('dissolve_subgraph'), subgraphId: z.string().min(1) }),
  z.object({ type: z.literal('add_edge'), edge: graphEdgeSchema }),
  z.object({
    type: z.literal('update_edge'),
    edgeId: z.string().min(1),
    patch: graphEdgePatchSchema,
  }),
  z.object({ type: z.literal('remove_edge'), edgeId: z.string().min(1) }),
  z.object({ type: z.literal('add_relationship'), relationship: nonNativeRelationshipSchema }),
  z.object({
    type: z.literal('update_relationship'),
    relationshipId: z.string().min(1),
    patch: nonNativeRelationshipPatchSchema,
  }),
  z.object({ type: z.literal('remove_relationship'), relationshipId: z.string().min(1) }),
]);

export const proposalInputSchema = z.object({
  operations: z.array(graphOperationSchema).min(1),
  rationale: z.string().min(1),
  expectedGraphUpdatedAt: z.string().min(1).optional(),
});

export const sampleGraph: WorkflowGraph = {
  schemaVersion: '6',
  id: 'customer-support-contract',
  name: 'Customer Support Workflow',
  status: 'draft',
  updatedAt: '2026-08-28T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  nodes: [
    { id: 'start', kind: 'start', label: 'Start', position: { x: 40, y: 230 } },
    {
      id: 'classifier',
      kind: 'step',
      executor: 'ai',
      label: 'Classifier Agent',
      description: 'Classifies the support request.',
      position: { x: 230, y: 220 },
    },
    {
      id: 'billing',
      kind: 'step',
      executor: 'ai',
      label: 'Billing Agent',
      position: { x: 480, y: 60 },
    },
    {
      id: 'diagnostic',
      kind: 'step',
      executor: 'deterministic',
      label: 'Diagnostic Action',
      position: { x: 480, y: 220 },
    },
    {
      id: 'human',
      kind: 'step',
      executor: 'human',
      label: 'Human Input',
      position: { x: 480, y: 380 },
    },
    {
      id: 'refund',
      kind: 'step',
      executor: 'tool',
      label: 'Refund Tool',
      position: { x: 730, y: 60 },
    },
    { id: 'end', kind: 'end', label: 'End', position: { x: 940, y: 220 } },
  ],
  edges: [
    { id: 'start-classifier', source: 'start', target: 'classifier', mode: 'normal' },
    {
      id: 'classifier-billing',
      source: 'classifier',
      target: 'billing',
      mode: 'conditional',
      label: 'billing',
    },
    {
      id: 'classifier-diagnostic',
      source: 'classifier',
      target: 'diagnostic',
      mode: 'conditional',
      label: 'technical',
    },
    {
      id: 'classifier-human',
      source: 'classifier',
      target: 'human',
      mode: 'conditional',
      label: 'unknown',
    },
    { id: 'billing-refund', source: 'billing', target: 'refund', mode: 'normal' },
    { id: 'refund-end', source: 'refund', target: 'end', mode: 'normal' },
    { id: 'diagnostic-end', source: 'diagnostic', target: 'end', mode: 'normal' },
    { id: 'human-end', source: 'human', target: 'end', mode: 'normal' },
  ],
  subgraphs: [],
  relationships: [],
};

/** A compact authored contract used to demonstrate that human outcomes follow
 * canonical topology. It is intentionally a design-time preview fixture: no
 * runtime response, resume, or side effect is executed by loading it. */
export const humanControlHitlDemoGraph: WorkflowGraph = {
  schemaVersion: '6',
  id: 'human-control-hitl-demo',
  name: 'Human Control · Deploy Change',
  status: 'draft',
  updatedAt: '2026-08-30T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  nodes: [
    { id: 'human-control-start', kind: 'start', label: 'Start', position: { x: 40, y: 280 } },
    {
      id: 'deploy-change',
      kind: 'step',
      executor: 'tool',
      label: 'Deploy change',
      description: 'Applies an approved production change with a human gate.',
      position: { x: 250, y: 280 },
      hitl: {
        enabled: true,
        timing: 'before',
        activation: { reason: 'This action modifies production.' },
        response: {
          type: 'approval',
          allowedOutcomes: [
            { id: 'approve', label: 'Approve', resumeNodeId: 'change-completed' },
            { id: 'request-changes', label: 'Request changes', resumeNodeId: 'revise-change-plan' },
            { id: 'reject', label: 'Reject', resumeNodeId: 'change-cancelled' },
          ],
        },
      },
      sensitive: {
        target: 'Production deployment',
        authorization: 'Release manager',
        approvalRequired: true,
        idempotency: 'Deployment request ID',
      },
    },
    {
      id: 'change-completed',
      kind: 'end',
      label: 'Completed',
      position: { x: 710, y: 80 },
    },
    {
      id: 'revise-change-plan',
      kind: 'step',
      executor: 'ai',
      label: 'Revise change plan',
      description: 'Updates the proposed change before it is reviewed again.',
      position: { x: 560, y: 280 },
    },
    {
      id: 'revision-prepared',
      kind: 'end',
      label: 'Revision prepared',
      position: { x: 860, y: 280 },
    },
    {
      id: 'change-cancelled',
      kind: 'end',
      label: 'Cancelled',
      position: { x: 710, y: 480 },
    },
  ],
  edges: [
    { id: 'human-control-start-deploy', source: 'human-control-start', target: 'deploy-change', mode: 'normal' },
    {
      id: 'deploy-approved',
      source: 'deploy-change',
      target: 'change-completed',
      mode: 'conditional',
      label: 'approve',
    },
    {
      id: 'deploy-request-changes',
      source: 'deploy-change',
      target: 'revise-change-plan',
      mode: 'conditional',
      label: 'request changes',
    },
    {
      id: 'deploy-rejected',
      source: 'deploy-change',
      target: 'change-cancelled',
      mode: 'conditional',
      label: 'reject',
    },
    {
      id: 'revision-prepared',
      source: 'revise-change-plan',
      target: 'revision-prepared',
      mode: 'normal',
    },
  ],
  subgraphs: [],
  relationships: [],
};

/** A compact valid fixture for the first-class subgraph interaction. */
export const researchSupervisorGraph: WorkflowGraph = {
  schemaVersion: '6',
  id: 'research-supervisor-demo',
  name: 'Research Supervisor Workflow',
  status: 'draft',
  updatedAt: '2026-08-29T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  nodes: [
    {
      id: 'research-outer-start',
      kind: 'start',
      label: 'Start',
      position: { x: 60, y: 250 },
    },
    {
      id: 'research-subgraph-start',
      kind: 'start',
      label: 'Research Start',
      parentId: 'research-supervisor',
      position: { x: 36, y: 130 },
    },
    {
      id: 'research-supervisor-agent',
      kind: 'step',
      executor: 'ai',
      label: 'Supervisor',
      description: 'Plans the research sequence and synthesizes the result.',
      parentId: 'research-supervisor',
      position: { x: 220, y: 130 },
      config: { role: 'research_supervisor', capability: 'ai' },
    },
    {
      id: 'research-supervisor-tools',
      kind: 'step',
      executor: 'tool',
      label: 'Supervisor Tools',
      description: 'Research retrieval and source-review tools available to the supervisor.',
      parentId: 'research-supervisor',
      position: { x: 415, y: 130 },
      config: { capability: 'research_tools', tools: ['search', 'source_review'] },
    },
    {
      id: 'research-subgraph-end',
      kind: 'end',
      label: 'Research Complete',
      parentId: 'research-supervisor',
      position: { x: 600, y: 130 },
    },
    {
      id: 'research-outer-end',
      kind: 'end',
      label: 'End',
      position: { x: 930, y: 250 },
    },
  ],
  edges: [
    {
      id: 'research-enter-subgraph',
      source: 'research-outer-start',
      target: 'research-subgraph-start',
      mode: 'normal',
    },
    {
      id: 'research-start-supervisor',
      source: 'research-subgraph-start',
      target: 'research-supervisor-agent',
      mode: 'normal',
    },
    {
      id: 'research-supervisor-tools',
      source: 'research-supervisor-agent',
      target: 'research-supervisor-tools',
      mode: 'normal',
    },
    {
      id: 'research-tools-end',
      source: 'research-supervisor-tools',
      target: 'research-subgraph-end',
      mode: 'normal',
    },
    {
      id: 'research-exit-subgraph',
      source: 'research-subgraph-end',
      target: 'research-outer-end',
      mode: 'normal',
    },
  ],
  subgraphs: [
    {
      id: 'research-supervisor',
      label: 'Research Supervisor',
      position: { x: 220, y: 120 },
      dimensions: { width: 760, height: 320 },
      collapsed: false,
    },
  ],
  relationships: [],
};

/** The canonical routing-semantics fixture. A return edge is normal topology,
 * so loop presentation can be derived without persisting a separate mode. */
export const researchIntakeRoutingGraph: WorkflowGraph = {
  schemaVersion: '6',
  id: 'research-intake-routing-demo',
  name: 'Research Intake Routing',
  status: 'draft',
  updatedAt: '2026-08-30T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  nodes: [
    { id: 'research-intake-start', kind: 'start', label: 'Start', position: { x: 40, y: 280 } },
    {
      id: 'clarify-request',
      kind: 'step',
      executor: 'ai',
      label: 'Clarify Request',
      description: 'Clarifies the research request before authoring the brief.',
      position: { x: 180, y: 280 },
    },
    {
      id: 'awaiting-user-reply',
      kind: 'end',
      label: 'Awaiting user reply',
      position: { x: 420, y: 80 },
    },
    {
      id: 'write-research-brief',
      kind: 'step',
      executor: 'ai',
      label: 'Write Research Brief',
      position: { x: 480, y: 280 },
    },
    {
      id: 'research-supervisor',
      kind: 'step',
      executor: 'ai',
      label: 'Research Supervisor',
      position: { x: 730, y: 280 },
    },
    {
      id: 'final-report',
      kind: 'step',
      executor: 'ai',
      label: 'Final Report',
      position: { x: 980, y: 280 },
    },
    { id: 'report-complete', kind: 'end', label: 'Report complete', position: { x: 1180, y: 280 } },
    {
      id: 'researcher',
      kind: 'step',
      executor: 'ai',
      label: 'Researcher',
      position: { x: 700, y: 500 },
    },
    {
      id: 'human-review',
      kind: 'end',
      label: 'Human Review',
      description: 'The fallback route ends in human review.',
      position: { x: 980, y: 500 },
    },
  ],
  edges: [
    { id: 'research-intake-start-clarify', source: 'research-intake-start', target: 'clarify-request', mode: 'normal' },
    {
      id: 'clarify-write-brief',
      source: 'clarify-request',
      target: 'write-research-brief',
      mode: 'command',
      label: 'ready',
      condition: 'state.ready === true',
    },
    {
      id: 'clarify-await-reply',
      source: 'clarify-request',
      target: 'awaiting-user-reply',
      mode: 'command',
      label: 'needs clarification',
      condition: 'state.needsClarification === true',
    },
    {
      id: 'brief-supervisor',
      source: 'write-research-brief',
      target: 'research-supervisor',
      mode: 'normal',
    },
    {
      id: 'supervisor-final-report',
      source: 'research-supervisor',
      target: 'final-report',
      mode: 'conditional',
      label: 'enough evidence',
      condition: 'evidence.isSufficient === true',
    },
    {
      id: 'supervisor-researcher',
      source: 'research-supervisor',
      target: 'researcher',
      mode: 'conditional',
      label: 'more research',
      condition: 'evidence.isSufficient === false',
    },
    {
      id: 'supervisor-human-review',
      source: 'research-supervisor',
      target: 'human-review',
      mode: 'fallback',
      label: 'fallback',
    },
    { id: 'final-report-complete', source: 'final-report', target: 'report-complete', mode: 'normal' },
    {
      id: 'researcher-continue',
      source: 'researcher',
      target: 'research-supervisor',
      mode: 'normal',
      label: 'continue',
    },
  ],
  subgraphs: [],
  relationships: [],
};

const issue = (code: string, message: string, path?: string): ValidationIssue => ({
  code,
  message,
  path,
});

/** Converts Zod's array offsets into the stable domain IDs used by the canvas. */
function stableSchemaIssuePath(graph: unknown, path: PropertyKey[]): string {
  const [collection, index, ...rest] = path;
  if (
    (collection === 'nodes' || collection === 'edges' || collection === 'relationships') &&
    typeof index === 'number' &&
    graph &&
    typeof graph === 'object'
  ) {
    const records = (graph as Record<string, unknown>)[collection];
    const candidate = Array.isArray(records) ? records[index] : undefined;
    if (candidate && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string') {
      return [collection, (candidate as { id: string }).id, ...rest].join('.');
    }
  }
  return path.join('.');
}

const compareEdges = (a: GraphEdge, b: GraphEdge) =>
  [a.source, a.target, a.mode, a.label ?? '', a.condition ?? '', a.id]
    .join('\u0000')
    .localeCompare([b.source, b.target, b.mode, b.label ?? '', b.condition ?? '', b.id].join('\u0000'));

type TopologyLoop = {
  /** The return edge discovered by deterministic depth-first traversal. */
  loopEdgeId: string;
  /** Every edge in the corresponding directed cycle, in traversal order. */
  edgeIds: string[];
};

function deriveTopologyLoops(
  startId: string,
  outgoing: ReadonlyMap<string, readonly GraphEdge[]>,
): TopologyLoop[] {
  const loops: TopologyLoop[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nodeStack: string[] = [];
  const edgeStack: GraphEdge[] = [];

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    nodeStack.push(nodeId);
    for (const edge of [...(outgoing.get(nodeId) ?? [])].sort(compareEdges)) {
      if (visiting.has(edge.target)) {
        const cycleStart = nodeStack.indexOf(edge.target);
        loops.push({
          loopEdgeId: edge.id,
          edgeIds: [...edgeStack.slice(cycleStart).map((candidate) => candidate.id), edge.id],
        });
      } else {
        edgeStack.push(edge);
        visit(edge.target);
        edgeStack.pop();
      }
    }
    nodeStack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  visit(startId);
  return loops;
}

export function validateGraph(graph: WorkflowGraph): ValidationIssue[] {
  const parsed = workflowGraphSchema.safeParse(graph);
  if (!parsed.success) {
    return parsed.error.issues.map((entry) =>
      issue(
        'INVALID_SCHEMA',
        entry.message,
        stableSchemaIssuePath(
          graph,
          entry.code === 'unrecognized_keys' ? [...entry.path, ...entry.keys] : entry.path,
        ),
      ),
    );
  }

  const normalized = normalizeWorkflowGraph(parsed.data);
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const subgraphIds = new Set<string>();
  const nodeById = new Map<string, GraphNode>();
  const edgesByConnection = new Map<string, GraphEdge[]>();
  const relationshipIds = new Set<string>();

  const validateProvenance = (
    provenance: Provenance,
    path: string,
    surface: 'native-node' | 'native-edge' | 'non-native-relationship',
  ) => {
    if (
      (provenance.representation === 'runtime-generated' ||
        provenance.representation === 'derived-semantic' ||
        provenance.representation === 'external-orchestration') &&
      !provenance.evidence
    ) {
      issues.push(
        issue(
          'PROVENANCE_EVIDENCE_REQUIRED',
          `${provenance.representation} claims require explicit evidence.`,
          `${path}.evidence`,
        ),
      );
    }
    if (
      (surface === 'native-node' || surface === 'native-edge') &&
      provenance.representation === 'external-orchestration'
    ) {
      issues.push(
        issue(
          'EXTERNAL_ORCHESTRATION_PROVENANCE_REQUIRES_NON_NATIVE_RELATIONSHIP',
          'External orchestration provenance belongs only to a non-native relationship.',
          `${path}.representation`,
        ),
      );
    }
  };

  const validateStateCapability = (state: WorkingStateCapability, path: string) => {
    for (const [index, field] of state.schema.fields.entries()) {
      if (!field.trim()) {
        issues.push(issue('STATE_SCHEMA_FIELD_REQUIRED', 'State schema fields must be readable.', `${path}.schema.fields.${index}`));
      }
    }
    const normalizedFields = state.schema.fields.map((field) => field.trim()).filter(Boolean);
    if (new Set(normalizedFields).size !== normalizedFields.length) {
      issues.push(issue('STATE_SCHEMA_FIELD_DUPLICATE', 'State schema fields must be unique.', `${path}.schema.fields`));
    }
    const reducerKeys = state.reducers.map((reducer) => reducer.key.trim());
    for (const [index, reducer] of state.reducers.entries()) {
      if (!reducer.key.trim()) {
        issues.push(issue('STATE_REDUCER_KEY_REQUIRED', 'State reducer keys must be readable.', `${path}.reducers.${index}.key`));
      }
      if (!reducer.summary.trim()) {
        issues.push(issue('STATE_REDUCER_SUMMARY_REQUIRED', 'State reducers need a readable summary.', `${path}.reducers.${index}.summary`));
      }
    }
    if (new Set(reducerKeys.filter(Boolean)).size !== reducerKeys.filter(Boolean).length) {
      issues.push(issue('STATE_REDUCER_KEY_DUPLICATE', 'State reducer keys must be unique.', `${path}.reducers`));
    }
  };
  const validateCheckpointerCapability = (checkpointer: CheckpointerCapability, path: string) => {
    if (!checkpointer.enabled && checkpointer.durableThread.required) {
      issues.push(issue('CHECKPOINTER_DISABLED_WITH_REQUIRED_THREAD', 'A required durable thread needs an enabled Checkpointer.', `${path}.durableThread.required`));
    }
    if (
      checkpointer.enabled &&
      checkpointer.durableThread.required &&
      !checkpointer.durableThread.threadIdSource?.trim()
    ) {
      issues.push(issue('CHECKPOINTER_THREAD_ID_SOURCE_REQUIRED', 'A required durable thread needs a readable thread ID source.', `${path}.durableThread.threadIdSource`));
    }
    if (checkpointer.backend !== undefined && !checkpointer.backend.trim()) {
      issues.push(issue('CHECKPOINTER_BACKEND_REQUIRED', 'Checkpointer backend must be readable when supplied.', `${path}.backend`));
    }
  };
  const validateStoreCapability = (store: LongTermStoreCapability, path: string) => {
    if (store.namespace !== undefined && !store.namespace.trim()) {
      issues.push(issue('STORE_NAMESPACE_REQUIRED', 'Store namespace must be readable when supplied.', `${path}.namespace`));
    }
    if (store.retention !== undefined && !store.retention.trim()) {
      issues.push(issue('STORE_RETENTION_REQUIRED', 'Store retention must be readable when supplied.', `${path}.retention`));
    }
  };

  validateStateCapability(normalized.capabilities.state, 'capabilities.state');
  validateCheckpointerCapability(normalized.capabilities.checkpointer, 'capabilities.checkpointer');
  validateStoreCapability(normalized.capabilities.store, 'capabilities.store');
  const runtimeInput = normalized.capabilities.runtimeMode.input;
  if (
    runtimeInput !== undefined &&
    ((normalized.capabilities.runtimeMode.mode === 'text' && runtimeInput !== 'text') ||
      (normalized.capabilities.runtimeMode.mode === 'voice' && runtimeInput !== 'audio') ||
      normalized.capabilities.runtimeMode.mode === 'unspecified')
  ) {
    issues.push(issue('RUNTIME_MODE_INPUT_MISMATCH', 'Runtime mode and input metadata must agree.', 'capabilities.runtimeMode.input'));
  }

  for (const subgraph of normalized.subgraphs) {
    if (subgraphIds.has(subgraph.id)) {
      issues.push(
        issue('DUPLICATE_SUBGRAPH_ID', `Subgraph ID “${subgraph.id}” is duplicated.`, `subgraphs.${subgraph.id}`),
      );
    }
    subgraphIds.add(subgraph.id);
    const overrides = subgraph.capabilityOverrides;
    if (overrides) {
      if (Object.keys(overrides).length === 0) {
        issues.push(issue('SUBGRAPH_CAPABILITY_OVERRIDE_EMPTY', `Subgraph “${subgraph.label}” must override at least one supported capability.`, `subgraphs.${subgraph.id}.capabilityOverrides`));
      }
      if (overrides.state) validateStateCapability(overrides.state, `subgraphs.${subgraph.id}.capabilityOverrides.state`);
      if (overrides.checkpointer) validateCheckpointerCapability(overrides.checkpointer, `subgraphs.${subgraph.id}.capabilityOverrides.checkpointer`);
      if (overrides.store) validateStoreCapability(overrides.store, `subgraphs.${subgraph.id}.capabilityOverrides.store`);
    }
  }

  for (const node of normalized.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(issue('DUPLICATE_NODE_ID', `Node ID “${node.id}” is duplicated.`, `nodes.${node.id}`));
    }
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
    validateProvenance(node.provenance!, `nodes.${node.id}.provenance`, 'native-node');
    if (subgraphIds.has(node.id)) {
      issues.push(
        issue(
          'SUBGRAPH_NODE_ID_CONFLICT',
          `Node ID “${node.id}” conflicts with a subgraph ID.`,
          `nodes.${node.id}`,
        ),
      );
    }
    if (node.parentId && !subgraphIds.has(node.parentId)) {
      issues.push(
        issue(
          'MISSING_NODE_PARENT',
          `Node “${node.label}” references a subgraph that does not exist.`,
          `nodes.${node.id}.parentId`,
        ),
      );
    }
    if (node.kind !== 'step' && (node as { hitl?: HitlConfig }).hitl?.enabled) {
      issues.push(
        issue(
          'INVALID_HITL_NODE',
          'Embedded human-in-the-loop controls are only allowed on Step nodes.',
          `nodes.${node.id}.hitl`,
        ),
      );
    }
    if (node.kind === 'end' && node.outcome?.kind === 'domain-specific' && !node.outcome.detail?.trim()) {
      issues.push(
        issue(
          'END_OUTCOME_DETAIL_REQUIRED',
          `Domain-specific End outcome on “${node.label}” needs a readable detail.`,
          `nodes.${node.id}.outcome.detail`,
        ),
      );
    }
  }

  for (const edge of normalized.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push(issue('DUPLICATE_EDGE_ID', `Edge ID “${edge.id}” is duplicated.`, `edges.${edge.id}`));
    }
    edgeIds.add(edge.id);
    validateProvenance(edge.provenance!, `edges.${edge.id}.provenance`, 'native-edge');
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(
        issue(
          'MISSING_EDGE_NODE',
          `Edge “${edge.id}” references a node that does not exist.`,
          `edges.${edge.id}`,
        ),
      );
      continue;
    }

    const source = nodeById.get(edge.source)!;
    const target = nodeById.get(edge.target)!;
    if (edge.source === edge.target) {
      issues.push(
        issue(
          'SELF_CONNECTION',
          `Edge “${edge.id}” cannot connect “${source.label}” to itself.`,
          `edges.${edge.id}`,
        ),
      );
    }
    const connectionKey = `${edge.source}\u0000${edge.target}`;
    edgesByConnection.set(connectionKey, [...(edgesByConnection.get(connectionKey) ?? []), edge]);
    if (source.parentId !== target.parentId) {
      if (source.parentId && source.kind !== 'end') {
        issues.push(
          issue(
            'INVALID_SUBGRAPH_EXIT',
            `Only an internal End node may leave subgraph “${source.parentId}”.`,
            `edges.${edge.id}`,
          ),
        );
      }
      if (target.parentId && target.kind !== 'start') {
        issues.push(
          issue(
            'INVALID_SUBGRAPH_ENTRY',
            `Only an internal Start node may receive an edge into subgraph “${target.parentId}”.`,
            `edges.${edge.id}`,
          ),
        );
      }
    }
  }

  for (const relationship of normalized.relationships) {
    if (relationshipIds.has(relationship.id) || edgeIds.has(relationship.id)) {
      issues.push(
        issue(
          'DUPLICATE_RELATIONSHIP_ID',
          `Relationship ID “${relationship.id}” conflicts with another relationship or native edge.`,
          `relationships.${relationship.id}`,
        ),
      );
    }
    relationshipIds.add(relationship.id);
    validateProvenance(
      relationship.provenance,
      `relationships.${relationship.id}.provenance`,
      'non-native-relationship',
    );

    const endpoints = [relationship.source, relationship.target];
    const nodeEndpointCount = endpoints.filter((endpoint) => endpoint.kind === 'node').length;
    const externalEndpointCount = endpoints.filter((endpoint) => endpoint.kind === 'external').length;
    if (nodeEndpointCount !== 1 || externalEndpointCount !== 1) {
      issues.push(
        issue(
          'RELATIONSHIP_BOUNDARY_ENDPOINTS_REQUIRED',
          `Relationship “${relationship.id}” must cross exactly one graph boundary.`,
          `relationships.${relationship.id}`,
        ),
      );
    }
    for (const [endpointName, endpoint] of [
      ['source', relationship.source],
      ['target', relationship.target],
    ] as const) {
      if (endpoint.kind === 'node' && !nodeIds.has(endpoint.nodeId)) {
        issues.push(
          issue(
            'RELATIONSHIP_MISSING_NODE',
            `Relationship “${relationship.id}” references a node that does not exist.`,
            `relationships.${relationship.id}.${endpointName}.nodeId`,
          ),
        );
      }
    }
    if (
      relationship.kind === 'external-orchestration' &&
      relationship.provenance.representation !== 'external-orchestration'
    ) {
      issues.push(
        issue(
          'EXTERNAL_RELATIONSHIP_PROVENANCE_REQUIRED',
          'External orchestration relationships require external-orchestration provenance.',
          `relationships.${relationship.id}.provenance.representation`,
        ),
      );
    }
    if (
      relationship.kind !== 'external-orchestration' &&
      relationship.provenance.representation === 'external-orchestration'
    ) {
      issues.push(
        issue(
          'EXTERNAL_ORCHESTRATION_PROVENANCE_KIND_MISMATCH',
          'External orchestration provenance requires an external-orchestration relationship.',
          `relationships.${relationship.id}.provenance.representation`,
        ),
      );
    }
    if (
      relationship.kind === 'external-orchestration' &&
      !normalized.capabilities.provenance.externalOrchestrationAvailable
    ) {
      issues.push(
        issue(
          'EXTERNAL_ORCHESTRATION_CAPABILITY_REQUIRED',
          'External orchestration relationships require the graph capability to be available.',
          'capabilities.provenance.externalOrchestrationAvailable',
        ),
      );
    }
  }

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const edge of normalized.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  const sendEdges = normalized.edges.filter((edge) => edge.mode === 'send');
  for (const edge of sendEdges) {
    const send = edge.send;
    const source = nodeById.get(edge.source);
    const template = nodeById.get(edge.target);
    if (!send) {
      issues.push(
        issue('SEND_CONFIGURATION_REQUIRED', `Send edge “${edge.id}” needs its map configuration.`, `edges.${edge.id}.send`),
      );
      continue;
    }
    if (!send.destinationTemplateId.trim()) {
      issues.push(
        issue(
          'SEND_TEMPLATE_REQUIRED',
          `Send edge “${edge.id}” needs a readable destination template ID.`,
          `edges.${edge.id}.send.destinationTemplateId`,
        ),
      );
    }
    if (!send.payloadLabel.trim()) {
      issues.push(
        issue(
          'SEND_PAYLOAD_LABEL_REQUIRED',
          `Send edge “${edge.id}” needs a readable payload label.`,
          `edges.${edge.id}.send.payloadLabel`,
        ),
      );
    }
    if (!send.mergeNodeId.trim()) {
      issues.push(
        issue(
          'SEND_MERGE_REQUIRED',
          `Send edge “${edge.id}” needs a Merge junction ID.`,
          `edges.${edge.id}.send.mergeNodeId`,
        ),
      );
    }
    if (send.payloadSchemaRef !== undefined && !send.payloadSchemaRef.trim()) {
      issues.push(
        issue(
          'SEND_PAYLOAD_SCHEMA_REF_REQUIRED',
          `Send edge “${edge.id}” needs a readable payload schema reference when supplied.`,
          `edges.${edge.id}.send.payloadSchemaRef`,
        ),
      );
    }
    if (source?.kind !== 'step') {
      issues.push(
        issue('SEND_SOURCE_STEP_REQUIRED', `Send edge “${edge.id}” must start at a Step.`, `edges.${edge.id}.source`),
      );
    }
    if (template?.kind !== 'step') {
      issues.push(
        issue('SEND_TEMPLATE_STEP_REQUIRED', `Send edge “${edge.id}” must target a Step template.`, `edges.${edge.id}.target`),
      );
    }
    if (send.destinationTemplateId !== edge.target) {
      issues.push(
        issue(
          'SEND_TEMPLATE_TARGET_MISMATCH',
          `Send destination template must equal edge target “${edge.target}”.`,
          `edges.${edge.id}.send.destinationTemplateId`,
        ),
      );
    }
    if (source && template && source.parentId !== template.parentId) {
      issues.push(
        issue(
          'SEND_SCOPE_INVALID',
          `Send edge “${edge.id}” cannot cross a subgraph boundary.`,
          `edges.${edge.id}`,
        ),
      );
    }

    const merge = nodeById.get(send.mergeNodeId);
    if (merge?.kind !== 'merge') {
      issues.push(
        issue(
          'SEND_MERGE_REQUIRED',
          `Send edge “${edge.id}” must reference a Merge junction.`,
          `edges.${edge.id}.send.mergeNodeId`,
        ),
      );
      continue;
    }
    if (
      source?.parentId !== merge.parentId ||
      template?.parentId !== merge.parentId
    ) {
      issues.push(
        issue(
          'SEND_MERGE_SCOPE_INVALID',
          `Send edge “${edge.id}”, its template, and Merge must share one scope.`,
          `edges.${edge.id}.send.mergeNodeId`,
        ),
      );
    }
    const templateContinuations = (outgoing.get(edge.target) ?? []).filter(
      (candidate) => candidate.mode === 'normal' && candidate.target === merge.id,
    );
    if (templateContinuations.length !== 1) {
      issues.push(
        issue(
          'SEND_TEMPLATE_CONTINUATION_REQUIRED',
          `Send template “${edge.target}” needs one normal edge directly to Merge “${merge.id}”.`,
          `edges.${edge.id}.send.mergeNodeId`,
        ),
      );
    }
  }

  for (const node of normalized.nodes) {
    if (node.kind !== 'merge') continue;
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    const normalContinuations = nodeOutgoing.filter((edge) => edge.mode === 'normal');
    const dynamicInputs = sendEdges.filter((edge) => edge.send?.mergeNodeId === node.id);
    if (!node.merge.reducer.name.trim()) {
      issues.push(
        issue(
          'MERGE_REDUCER_REQUIRED',
          `Merge “${node.label}” needs a readable reducer name.`,
          `nodes.${node.id}.merge.reducer.name`,
        ),
      );
    }
    if (!node.merge.reducer.aggregateState.trim()) {
      issues.push(
        issue(
          'MERGE_AGGREGATE_STATE_REQUIRED',
          `Merge “${node.label}” needs a readable aggregate state.`,
          `nodes.${node.id}.merge.reducer.aggregateState`,
        ),
      );
    }
    if (dynamicInputs.length === 0) {
      issues.push(
        issue(
          'MERGE_DYNAMIC_INPUT_REQUIRED',
          `Merge “${node.label}” needs a dynamic Send input.`,
          `nodes.${node.id}.merge`,
        ),
      );
    }
    if (normalContinuations.length !== 1 || nodeOutgoing.length !== 1) {
      issues.push(
        issue(
          'MERGE_CONTINUATION_REQUIRED',
          `Merge “${node.label}” needs exactly one normal continuation.`,
          `nodes.${node.id}.merge.continuation`,
        ),
      );
    }
    if (node.merge.completion.mode === 'quorum' && !node.merge.completion.quorum) {
      issues.push(
        issue(
          'MERGE_QUORUM_REQUIRED',
          `Merge “${node.label}” needs a positive quorum completion value.`,
          `nodes.${node.id}.merge.completion.quorum`,
        ),
      );
    }
    if (node.merge.completion.mode !== 'quorum' && node.merge.completion.quorum !== undefined) {
      issues.push(
        issue(
          'MERGE_QUORUM_UNEXPECTED',
          `Only quorum completion may define a quorum value.`,
          `nodes.${node.id}.merge.completion.quorum`,
        ),
      );
    }
  }

  for (const node of normalized.nodes) {
    if (node.kind !== 'step') continue;
    const hitl = node.hitl;
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    const storeAccess = node.storeAccess;
    const effectiveCapabilities = resolveEffectiveCapabilities(normalized, node.parentId);

    if (node.readiness?.detail !== undefined && !node.readiness.detail.trim()) {
      issues.push(
        issue(
          'READINESS_DETAIL_REQUIRED',
          `Readiness detail on “${node.label}” must be readable when supplied.`,
          `nodes.${node.id}.readiness.detail`,
        ),
      );
    }
    if (node.opaque) {
      if (!node.opaque.factoryLabel.trim()) {
        issues.push(
          issue(
            'OPAQUE_FACTORY_LABEL_REQUIRED',
            `Opaque Step “${node.label}” needs a readable factory label.`,
            `nodes.${node.id}.opaque.factoryLabel`,
          ),
        );
      }
      for (const [portKind, ports] of [
        ['inputPorts', node.opaque.inputPorts],
        ['outputPorts', node.opaque.outputPorts],
      ] as const) {
        const names = ports.map((port) => port.name.trim()).filter(Boolean);
        if (names.length !== ports.length) {
          issues.push(
            issue(
              'OPAQUE_INTERFACE_PORT_NAME_REQUIRED',
              `Opaque Step “${node.label}” needs readable ${portKind}.`,
              `nodes.${node.id}.opaque.${portKind}`,
            ),
          );
        }
        if (new Set(names).size !== names.length) {
          issues.push(
            issue(
              'OPAQUE_INTERFACE_PORT_NAME_DUPLICATE',
              `Opaque Step “${node.label}” has duplicate ${portKind}.`,
              `nodes.${node.id}.opaque.${portKind}`,
            ),
          );
        }
      }
      if (
        node.opaque.runtimeInspection.available &&
        !node.opaque.runtimeInspection.evidence
      ) {
        issues.push(
          issue(
            'OPAQUE_RUNTIME_INSPECTION_EVIDENCE_REQUIRED',
            `Runtime inspection on “${node.label}” requires supplied evidence.`,
            `nodes.${node.id}.opaque.runtimeInspection.evidence`,
          ),
        );
      }
    }

    if (storeAccess?.read) {
      if (!effectiveCapabilities.store.value.available) {
        issues.push(
          issue(
            'STORE_READ_REQUIRES_AVAILABLE_STORE',
            `Step “${node.label}” directly reads Store, but Store is unavailable in its effective scope.`,
            `nodes.${node.id}.storeAccess.read`,
          ),
        );
      }
      if (storeAccess.read.namespace !== undefined && !storeAccess.read.namespace.trim()) {
        issues.push(issue('STORE_ACCESS_NAMESPACE_REQUIRED', 'Store access namespace must be readable when supplied.', `nodes.${node.id}.storeAccess.read.namespace`));
      }
      if (storeAccess.read.key !== undefined && !storeAccess.read.key.trim()) {
        issues.push(issue('STORE_ACCESS_KEY_REQUIRED', 'Store access key must be readable when supplied.', `nodes.${node.id}.storeAccess.read.key`));
      }
    }
    if (storeAccess?.write) {
      if (!effectiveCapabilities.store.value.available) {
        issues.push(
          issue(
            'STORE_WRITE_REQUIRES_AVAILABLE_STORE',
            `Step “${node.label}” directly writes Store, but Store is unavailable in its effective scope.`,
            `nodes.${node.id}.storeAccess.write`,
          ),
        );
      }
      if (storeAccess.write.namespace !== undefined && !storeAccess.write.namespace.trim()) {
        issues.push(issue('STORE_ACCESS_NAMESPACE_REQUIRED', 'Store access namespace must be readable when supplied.', `nodes.${node.id}.storeAccess.write.namespace`));
      }
      if (storeAccess.write.key !== undefined && !storeAccess.write.key.trim()) {
        issues.push(issue('STORE_ACCESS_KEY_REQUIRED', 'Store access key must be readable when supplied.', `nodes.${node.id}.storeAccess.write.key`));
      }
      if (storeAccess.write.retention !== undefined && !storeAccess.write.retention.trim()) {
        issues.push(issue('STORE_ACCESS_RETENTION_REQUIRED', 'Store write retention must be readable when supplied.', `nodes.${node.id}.storeAccess.write.retention`));
      }
    }

    const retry = node.retry;
    if (retry) {
      if (retry.maxAttempts === undefined) {
        issues.push(issue('RETRY_MAX_ATTEMPTS_REQUIRED', `Retry on “${node.label}” needs a maximum attempt count.`, `nodes.${node.id}.retry.maxAttempts`));
      } else if (retry.maxAttempts < 2 || retry.maxAttempts > 10) {
        issues.push(issue('RETRY_MAX_ATTEMPTS_INVALID', `Retry on “${node.label}” must allow two to ten attempts.`, `nodes.${node.id}.retry.maxAttempts`));
      }
      if (!retry.backoff) {
        issues.push(issue('RETRY_BACKOFF_REQUIRED', `Retry on “${node.label}” needs a backoff policy.`, `nodes.${node.id}.retry.backoff`));
      } else {
        if (!retry.backoff.strategy) {
          issues.push(issue('RETRY_BACKOFF_STRATEGY_REQUIRED', `Retry on “${node.label}” needs a backoff strategy.`, `nodes.${node.id}.retry.backoff.strategy`));
        }
        if (retry.backoff.initialDelayMs === undefined) {
          issues.push(issue('RETRY_BACKOFF_DELAY_REQUIRED', `Retry on “${node.label}” needs an initial delay.`, `nodes.${node.id}.retry.backoff.initialDelayMs`));
        } else if (retry.backoff.initialDelayMs < 0) {
          issues.push(issue('RETRY_BACKOFF_DELAY_INVALID', `Retry on “${node.label}” cannot use a negative delay.`, `nodes.${node.id}.retry.backoff.initialDelayMs`));
        }
        if (retry.backoff.maxDelayMs !== undefined) {
          if (retry.backoff.maxDelayMs < 0 || (retry.backoff.initialDelayMs !== undefined && retry.backoff.maxDelayMs < retry.backoff.initialDelayMs)) {
            issues.push(issue('RETRY_BACKOFF_MAX_DELAY_INVALID', `Retry on “${node.label}” needs a non-negative maximum delay no smaller than its initial delay.`, `nodes.${node.id}.retry.backoff.maxDelayMs`));
          }
        }
      }
      for (const [index, condition] of (retry.retryOn ?? []).entries()) {
        if (!condition.trim()) {
          issues.push(issue('RETRY_CONDITION_REQUIRED', `Retry conditions on “${node.label}” must be readable.`, `nodes.${node.id}.retry.retryOn.${index}`));
        }
      }
      if (retry.fallback?.provider !== undefined && !retry.fallback.provider.trim()) {
        issues.push(issue('RETRY_FALLBACK_PROVIDER_REQUIRED', `Retry fallback provider on “${node.label}” must be readable when supplied.`, `nodes.${node.id}.retry.fallback.provider`));
      }
      if (retry.fallback?.model !== undefined && !retry.fallback.model.trim()) {
        issues.push(issue('RETRY_FALLBACK_MODEL_REQUIRED', `Retry fallback model on “${node.label}” must be readable when supplied.`, `nodes.${node.id}.retry.fallback.model`));
      }
    }

    if (hitl?.enabled) {
      if (!hitl.timing) {
        issues.push(
          issue(
            'HITL_TIMING_REQUIRED',
            `Enabled HITL on “${node.label}” needs before, inside, or after timing.`,
            `nodes.${node.id}.hitl.timing`,
          ),
        );
      }
      if (!hitl.response) {
        issues.push(
          issue(
            'HITL_RESPONSE_REQUIRED',
            `Enabled HITL on “${node.label}” needs a response contract.`,
            `nodes.${node.id}.hitl.response`,
          ),
        );
      } else {
        const response = hitl.response;
        if (response.allowedOutcomes.length === 0) {
          issues.push(
            issue(
              'HITL_OUTCOME_REQUIRED',
              `Enabled HITL on “${node.label}” needs at least one allowed outcome.`,
              `nodes.${node.id}.hitl.response.allowedOutcomes`,
            ),
          );
        }
        const outcomeIds = response.allowedOutcomes.map((outcome) => outcome.id);
        if (new Set(outcomeIds).size !== outcomeIds.length) {
          issues.push(
            issue(
              'HITL_OUTCOME_ID_DUPLICATE',
              `HITL outcome IDs on “${node.label}” must be unique.`,
              `nodes.${node.id}.hitl.response.allowedOutcomes`,
            ),
          );
        }
        for (const outcome of response.allowedOutcomes) {
          if (!nodeOutgoing.some((edge) => edge.target === outcome.resumeNodeId)) {
            issues.push(
              issue(
                'HITL_OUTCOME_DESTINATION_INVALID',
                `HITL outcome “${outcome.label}” must resume through an outgoing edge from “${node.label}”.`,
                `nodes.${node.id}.hitl.response.allowedOutcomes.${outcome.id}.resumeNodeId`,
              ),
            );
          }
        }
        if (response.type === 'selection') {
          const choices = response.selectionChoices ?? [];
          if (choices.length === 0) {
            issues.push(
              issue(
                'HITL_SELECTION_CHOICES_REQUIRED',
                `Selection HITL on “${node.label}” needs at least one choice.`,
                `nodes.${node.id}.hitl.response.selectionChoices`,
              ),
            );
          }
          const choiceIds = choices.map((choice) => choice.id);
          if (new Set(choiceIds).size !== choiceIds.length) {
            issues.push(
              issue(
                'HITL_SELECTION_CHOICE_ID_DUPLICATE',
                `Selection choice IDs on “${node.label}” must be unique.`,
                `nodes.${node.id}.hitl.response.selectionChoices`,
              ),
            );
          }
        } else if (response.selectionChoices && response.selectionChoices.length > 0) {
          issues.push(
            issue(
              'HITL_SELECTION_CHOICES_UNEXPECTED',
              `Only selection HITL may define selection choices on “${node.label}”.`,
              `nodes.${node.id}.hitl.response.selectionChoices`,
            ),
          );
        }
      }
    }

    if (node.sensitive?.approvalRequired) {
      const eligibleApprovalGate =
        hitl?.enabled &&
        hitl.timing === 'before' &&
        hitl.response?.type === 'approval' &&
        hitl.response.allowedOutcomes.some((outcome) => outcome.id === 'approve');
      if (!eligibleApprovalGate) {
        issues.push(
          issue(
            'SENSITIVE_APPROVAL_GATE_REQUIRED',
            `Approval-required sensitive policy on “${node.label}” needs an enabled before approval gate with an approve outcome.`,
            `nodes.${node.id}.sensitive.approvalRequired`,
          ),
        );
      }
    }
  }

  for (const connectionEdges of edgesByConnection.values()) {
    if (connectionEdges.length < 2) continue;
    for (const edge of connectionEdges) {
      issues.push(
        issue(
          'DUPLICATE_CONNECTION',
          `Only one connection from “${edge.source}” to “${edge.target}” is allowed.`,
          `edges.${edge.id}`,
        ),
      );
    }
  }

  const starts = normalized.nodes.filter((node) => node.kind === 'start' && !node.parentId);
  const ends = normalized.nodes.filter((node) => node.kind === 'end' && !node.parentId);
  if (starts.length !== 1) {
    issues.push(issue('START_COUNT', 'A contract must contain exactly one Start node.'));
  }
  if (ends.length < 1) {
    issues.push(issue('END_COUNT', 'A contract must contain at least one End node.'));
  }

  for (const subgraph of normalized.subgraphs) {
    const children = normalized.nodes.filter((node) => node.parentId === subgraph.id);
    const internalStarts = children.filter((node) => node.kind === 'start');
    const internalEnds = children.filter((node) => node.kind === 'end');

    if (internalStarts.length !== 1) {
      issues.push(
        issue(
          'SUBGRAPH_START_COUNT',
          `Subgraph “${subgraph.label}” must contain exactly one Start node.`,
          `subgraphs.${subgraph.id}`,
        ),
      );
    }
    if (internalEnds.length !== 1) {
      issues.push(
        issue(
          'SUBGRAPH_END_COUNT',
          `Subgraph “${subgraph.label}” must contain exactly one End node.`,
          `subgraphs.${subgraph.id}`,
        ),
      );
    }

    const internalStart = internalStarts[0];
    if (internalStart) {
      const entries = incoming.get(internalStart.id) ?? [];
      const internalEntries = entries.filter(
        (edge) => nodeById.get(edge.source)?.parentId === subgraph.id,
      );
      if (internalEntries.length > 0 || entries.length !== 1) {
        issues.push(
          issue(
            'SUBGRAPH_START_ENTRY',
            `Subgraph Start node “${internalStart.label}” needs exactly one incoming edge from outside its subgraph.`,
            `nodes.${internalStart.id}`,
          ),
        );
      }
    }

    const internalEnd = internalEnds[0];
    if (internalEnd) {
      const exits = outgoing.get(internalEnd.id) ?? [];
      const internalExits = exits.filter(
        (edge) => nodeById.get(edge.target)?.parentId === subgraph.id,
      );
      if (
        internalExits.length > 0 ||
        exits.length !== 1 ||
        exits[0]?.mode !== 'normal'
      ) {
        issues.push(
          issue(
            'SUBGRAPH_END_EXIT',
            `Subgraph End node “${internalEnd.label}” needs exactly one normal edge to outside its subgraph.`,
            `nodes.${internalEnd.id}`,
          ),
        );
      }
    }
  }

  for (const node of normalized.nodes) {
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    if (node.kind === 'end') {
      if (!node.parentId && nodeOutgoing.length > 0) {
        issues.push(
          issue(
            'END_HAS_OUTGOING',
            `End node “${node.label}” cannot have outgoing edges.`,
            `nodes.${node.id}`,
          ),
        );
      }
      continue;
    }

    const normal = nodeOutgoing.filter((edge) => edge.mode === 'normal');
    const conditional = nodeOutgoing.filter((edge) => edge.mode === 'conditional');
    const command = nodeOutgoing.filter((edge) => edge.mode === 'command');
    const fallback = nodeOutgoing.filter((edge) => edge.mode === 'fallback');
    const send = nodeOutgoing.filter((edge) => edge.mode === 'send');

    if (send.length > 0 && (normal.length > 0 || conditional.length > 0 || command.length > 0 || fallback.length > 0)) {
      issues.push(
        issue(
          'SEND_MIXED_ROUTING',
          `“${node.label}” cannot mix Send with normal or routed edges.`,
          `nodes.${node.id}`,
        ),
      );
    } else if (send.length > 0) {
      // One or more Send/map relationships are the source's complete control
      // family. They are static templates, never concrete worker instances.
      if (send.length !== 1) {
        issues.push(
          issue(
            'SEND_EDGE_COUNT',
            `“${node.label}” must have exactly one Send/map relationship to one worker template.`,
            `nodes.${node.id}`,
          ),
        );
      }
    } else if (normal.length > 0 && (conditional.length > 0 || command.length > 0 || fallback.length > 0)) {
      issues.push(
        issue('MIXED_ROUTING', `“${node.label}” cannot mix normal and routed edges.`, `nodes.${node.id}`),
      );
    } else if (normal.length > 1) {
      issues.push(
        issue(
          'MULTIPLE_NORMAL_EDGES',
          `“${node.label}” can have only one normal outgoing edge.`,
          `nodes.${node.id}`,
        ),
      );
    } else if (normal.length !== 1 && conditional.length === 0 && command.length === 0) {
      issues.push(
        issue('OUTGOING_REQUIRED', `“${node.label}” needs one normal edge, command edge, or two to five conditional edges.`, `nodes.${node.id}`),
      );
    }

    if (conditional.length > 0 && (conditional.length < 2 || conditional.length > 5)) {
      issues.push(
        issue(
          'CONDITIONAL_EDGE_COUNT',
          `“${node.label}” must have two to five conditional edges.`,
          `nodes.${node.id}`,
        ),
      );
    }
    if (fallback.length > 1) {
      issues.push(
        issue(
          'MULTIPLE_FALLBACKS',
          `“${node.label}” can have at most one fallback edge.`,
          `nodes.${node.id}`,
        ),
      );
    }
    if (fallback.length > 0 && conditional.length === 0) {
      issues.push(
        issue(
          'FALLBACK_WITHOUT_CONDITIONS',
          `“${node.label}” needs conditional edges before a fallback.`,
          `nodes.${node.id}`,
        ),
      );
    }

    const labels = conditional.map((edge) => edge.label?.trim() ?? '');
    if (labels.some((label) => !label)) {
      issues.push(
        issue(
          'CONDITIONAL_LABEL_REQUIRED',
          `Every conditional edge from “${node.label}” needs a label.`,
          `nodes.${node.id}`,
        ),
      );
    }
    if (new Set(labels).size !== labels.length) {
      issues.push(
        issue(
          'DUPLICATE_CONDITIONAL_LABEL',
          `Conditional labels from “${node.label}” must be unique.`,
          `nodes.${node.id}`,
        ),
      );
    }

    const commandLabels = command.map((edge) => edge.label?.trim() ?? '');
    if (commandLabels.some((label) => !label)) {
      issues.push(
        issue(
          'COMMAND_LABEL_REQUIRED',
          `Every command edge from “${node.label}” needs a label.`,
          `nodes.${node.id}`,
        ),
      );
    }

    for (const edge of [...conditional, ...command]) {
      if (edge.condition !== undefined && !edge.condition.trim()) {
        issues.push(
          issue(
            edge.mode === 'conditional' ? 'CONDITIONAL_CONDITION_REQUIRED' : 'COMMAND_CONDITION_REQUIRED',
            `Every supplied ${edge.mode} condition must be readable.`,
            `edges.${edge.id}.condition`,
          ),
        );
      }
    }
  }

  if (starts[0]) {
    for (const edge of incoming.get(starts[0].id) ?? []) {
      issues.push(
        issue('START_HAS_INCOMING', 'The Start node cannot have incoming edges.', `edges.${edge.id}`),
      );
    }
  }

  if (starts[0]) {
    const topologyLoops = deriveTopologyLoops(starts[0].id, outgoing);
    const loopEdgeIds = new Set(topologyLoops.map((loop) => loop.loopEdgeId));
    const edgeById = new Map(normalized.edges.map((edge) => [edge.id, edge]));
    for (const edge of normalized.edges) {
      if (edge.loopCap !== undefined && !loopEdgeIds.has(edge.id)) {
        issues.push(
          issue(
            'LOOP_CAP_REQUIRES_TOPOLOGY_LOOP',
            `Loop cap on “${edge.id}” requires a topology-derived return edge.`,
            `edges.${edge.id}.loopCap`,
          ),
        );
      }
    }
    for (const loop of topologyLoops) {
      const containsSend = loop.edgeIds.some((edgeId) => edgeById.get(edgeId)?.mode === 'send');
      const returnEdge = edgeById.get(loop.loopEdgeId);
      if (containsSend && returnEdge?.loopCap === undefined) {
        issues.push(
          issue(
            'SEND_LOOP_CAP_REQUIRED',
            'A topology cycle containing Send needs an explicit bounded loop cap on its return edge.',
            `edges.${loop.loopEdgeId}.loopCap`,
          ),
        );
      }
    }
  }

  if (starts[0]) {
    const visited = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      // A return edge is a valid routing loop. Its presentation is derived
      // from this topology; no separate persisted edge mode is introduced.
      visited.add(nodeId);
      for (const edge of outgoing.get(nodeId) ?? []) visit(edge.target);
    };

    visit(starts[0].id);

    const unreachable = normalized.nodes.filter((node) => !visited.has(node.id));
    if (unreachable.length > 0) {
      issues.push(
        issue(
          'UNREACHABLE_NODES',
          `Unreachable nodes: ${unreachable.map((node) => node.label).join(', ')}.`,
        ),
      );
    }

    const canReachEnd = new Set(ends.map((node) => node.id));
    const queue = [...canReachEnd];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of incoming.get(current) ?? []) {
        if (!canReachEnd.has(edge.source)) {
          canReachEnd.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    const deadEnds = normalized.nodes.filter((node) => !canReachEnd.has(node.id));
    if (deadEnds.length > 0) {
      issues.push(
        issue(
          'NO_TERMINAL_PATH',
          `Nodes without a path to End: ${deadEnds.map((node) => node.label).join(', ')}.`,
        ),
      );
    }
  }

  return issues;
}

/**
 * Runtime evidence is intentionally validated beside, rather than inside, the
 * canonical graph. Callers may project it read-only only after this succeeds.
 */
export function validateRuntimeProjectionFixture(
  fixture: RuntimeProjectionFixture,
  graph: WorkflowGraph,
): ValidationIssue[] {
  const parsed = runtimeProjectionFixtureSchema.safeParse(fixture);
  if (!parsed.success) {
    return parsed.error.issues.map((entry) =>
      issue('INVALID_RUNTIME_FIXTURE', entry.message, entry.path.join('.')),
    );
  }

  const issues: ValidationIssue[] = [];
  if (parsed.data.graphId !== graph.id) {
    issues.push(
      issue('RUNTIME_GRAPH_ID_MISMATCH', 'Runtime fixture graph ID does not match the accepted graph.', 'graphId'),
    );
  }
  if (parsed.data.graphUpdatedAt !== graph.updatedAt) {
    issues.push(
      issue(
        'RUNTIME_GRAPH_VERSION_MISMATCH',
        'Runtime fixture graph version does not match the accepted graph.',
        'graphUpdatedAt',
      ),
    );
  }
  const sendById = new Map(
    graph.edges.filter((edge) => edge.mode === 'send').map((edge) => [edge.id, edge]),
  );
  const instanceIds = new Set<string>();
  for (const instance of parsed.data.instances) {
    const path = `instances.${instance.id}`;
    if (instanceIds.has(instance.id)) {
      issues.push(issue('RUNTIME_INSTANCE_ID_DUPLICATE', `Runtime instance “${instance.id}” is duplicated.`, path));
    }
    instanceIds.add(instance.id);
    const send = sendById.get(instance.sendEdgeId);
    if (!send) {
      issues.push(
        issue('RUNTIME_SEND_EDGE_INVALID', `Runtime instance “${instance.id}” references no Send edge.`, `${path}.sendEdgeId`),
      );
    } else if (instance.templateNodeId !== send.target) {
      issues.push(
        issue(
          'RUNTIME_TEMPLATE_MISMATCH',
          `Runtime instance “${instance.id}” must use Send template “${send.target}”.`,
          `${path}.templateNodeId`,
        ),
      );
    }
  }
  return issues;
}

export function applyGraphOperations(
  graph: WorkflowGraph,
  operations: GraphOperation[],
): { graph: WorkflowGraph; errors: ValidationIssue[] } {
  const next: WorkflowGraph = normalizeWorkflowGraph(structuredClone(graph));
  // Proposals may be replayed against data loaded before subgraphs existed.
  // Keep that accepted data canonical even outside the persistence adapter.
  next.subgraphs ??= [];
  next.relationships ??= [];
  const errors: ValidationIssue[] = [];

  const hasSubgraph = (subgraphId: string) =>
    next.subgraphs.some((subgraph) => subgraph.id === subgraphId);
  const findNode = (nodeId: string) => next.nodes.find((node) => node.id === nodeId);
  const absoluteNodePosition = (node: GraphNode): GraphPosition => {
    const parent = node.parentId
      ? next.subgraphs.find((subgraph) => subgraph.id === node.parentId)
      : undefined;
    return parent
      ? { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
      : structuredClone(node.position);
  };
  const uniqueNodeIds = (nodeIds: string[]) => [...new Set(nodeIds)];
  const hasStepOnlyPatchFields = (patch: GraphNodePatch) =>
    ['executor', 'participation', 'storeAccess', 'retry', 'readiness', 'opaque', 'modifiers', 'hitl', 'sensitive'].some((field) => field in patch);
  const hasMergePatchFields = (patch: GraphNodePatch) => 'merge' in patch;
  const hasEndOnlyPatchFields = (patch: GraphNodePatch) => 'outcome' in patch;
  const missingNodes = (nodeIds: string[], operationIndex: number) => {
    const missing = uniqueNodeIds(nodeIds).filter((nodeId) => !findNode(nodeId));
    for (const nodeId of missing) {
      errors.push(issue('OPERATION_NOT_FOUND', `Node “${nodeId}” was not found.`, `operations.${operationIndex}`));
    }
    return missing.length > 0;
  };
  const relationshipReferencesMissingNode = (
    relationship: Pick<NonNativeRelationship, 'source' | 'target'>,
    operationIndex: number,
  ) => {
    const missing = [relationship.source, relationship.target].filter(
      (endpoint): endpoint is Extract<RelationshipEndpoint, { kind: 'node' }> =>
        endpoint.kind === 'node' && !findNode(endpoint.nodeId),
    );
    for (const endpoint of missing) {
      errors.push(
        issue(
          'OPERATION_NOT_FOUND',
          `Relationship node “${endpoint.nodeId}” was not found.`,
          `operations.${operationIndex}`,
        ),
      );
    }
    return missing.length > 0;
  };

  for (const [index, operation] of operations.entries()) {
    if (operation.type === 'add_node') {
      if (findNode(operation.node.id) || hasSubgraph(operation.node.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Node “${operation.node.id}” already exists.`, `operations.${index}`));
      } else if (operation.node.parentId && !hasSubgraph(operation.node.parentId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.node.parentId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes.push(structuredClone(operation.node));
      }
    } else if (operation.type === 'update_node') {
      const nodeIndex = next.nodes.findIndex((node) => node.id === operation.nodeId);
      if (nodeIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Node “${operation.nodeId}” was not found.`, `operations.${index}`));
      } else if (
        next.nodes[nodeIndex].kind !== 'step' &&
        hasStepOnlyPatchFields(operation.patch)
      ) {
        errors.push(
          issue(
            'STEP_FIELDS_REQUIRE_STEP',
            `Step-only fields can only update Step node “${operation.nodeId}”.`,
            `operations.${index}`,
          ),
        );
      } else if (
        next.nodes[nodeIndex].kind !== 'merge' &&
        hasMergePatchFields(operation.patch)
      ) {
        errors.push(
          issue(
            'MERGE_FIELDS_REQUIRE_MERGE',
            `Merge configuration can only update Merge node “${operation.nodeId}”.`,
            `operations.${index}`,
          ),
        );
      } else if (
        next.nodes[nodeIndex].kind !== 'end' &&
        hasEndOnlyPatchFields(operation.patch)
      ) {
        errors.push(
          issue(
            'END_OUTCOME_REQUIRES_END',
            `End outcome can only update End node “${operation.nodeId}”.`,
            `operations.${index}`,
          ),
        );
      } else {
        const patch = structuredClone(operation.patch);
        if (next.nodes[nodeIndex].kind === 'step') {
          const updated = { ...next.nodes[nodeIndex], ...patch } as StepGraphNode;
          if (patch.sensitive === null) delete updated.sensitive;
          if (patch.storeAccess === null) {
            delete updated.storeAccess;
            if (updated.modifiers) {
              const remainingModifiers = { ...updated.modifiers };
              delete remainingModifiers.storeRead;
              delete remainingModifiers.storeWrite;
              if (Object.keys(remainingModifiers).length > 0) updated.modifiers = remainingModifiers;
              else delete updated.modifiers;
            }
          }
          if (patch.retry === null) {
            delete updated.retry;
            if (updated.modifiers) {
              const remainingModifiers = { ...updated.modifiers };
              delete remainingModifiers.retryFallback;
              if (Object.keys(remainingModifiers).length > 0) updated.modifiers = remainingModifiers;
              else delete updated.modifiers;
            }
          }
          if (patch.opaque === null) {
            delete updated.opaque;
            if (updated.modifiers) {
              const remainingModifiers = { ...updated.modifiers };
              delete remainingModifiers.opaque;
              if (Object.keys(remainingModifiers).length > 0) updated.modifiers = remainingModifiers;
              else delete updated.modifiers;
            }
          }
          next.nodes[nodeIndex] = updated;
        } else {
          next.nodes[nodeIndex] = { ...next.nodes[nodeIndex], ...patch } as GraphNode;
        }
      }
    } else if (operation.type === 'remove_node') {
      if (!findNode(operation.nodeId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Node “${operation.nodeId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes = next.nodes.filter((node) => node.id !== operation.nodeId);
        next.edges = next.edges.filter(
          (edge) => edge.source !== operation.nodeId && edge.target !== operation.nodeId,
        );
        next.relationships = next.relationships.filter(
          (relationship) =>
            !(
              (relationship.source.kind === 'node' && relationship.source.nodeId === operation.nodeId) ||
              (relationship.target.kind === 'node' && relationship.target.nodeId === operation.nodeId)
            ),
        );
      }
    } else if (operation.type === 'add_subgraph') {
      if (hasSubgraph(operation.subgraph.id) || findNode(operation.subgraph.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Subgraph “${operation.subgraph.id}” already exists.`, `operations.${index}`));
      } else {
        next.subgraphs.push(structuredClone(operation.subgraph));
      }
    } else if (operation.type === 'update_subgraph') {
      const subgraphIndex = next.subgraphs.findIndex((subgraph) => subgraph.id === operation.subgraphId);
      if (subgraphIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}`));
      } else {
        // Child coordinates are already relative; a container position update
        // deliberately moves only the container.
        next.subgraphs[subgraphIndex] = {
          ...next.subgraphs[subgraphIndex],
          ...structuredClone(operation.patch),
        };
      }
    } else if (operation.type === 'update_graph_capabilities') {
      next.capabilities = {
        ...next.capabilities,
        ...structuredClone(operation.patch),
      };
    } else if (operation.type === 'set_subgraph_capability_override') {
      const subgraphIndex = next.subgraphs.findIndex((subgraph) => subgraph.id === operation.subgraphId);
      if (subgraphIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}.subgraphId`));
      } else {
        next.subgraphs[subgraphIndex] = {
          ...next.subgraphs[subgraphIndex],
          capabilityOverrides: {
            ...next.subgraphs[subgraphIndex].capabilityOverrides,
            ...structuredClone(operation.override),
          },
        };
      }
    } else if (operation.type === 'remove_subgraph_capability_override') {
      const subgraphIndex = next.subgraphs.findIndex((subgraph) => subgraph.id === operation.subgraphId);
      if (subgraphIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}.subgraphId`));
      } else {
        const current = next.subgraphs[subgraphIndex].capabilityOverrides;
        if (!current?.[operation.capability]) {
          errors.push(
            issue(
              'OPERATION_NOT_FOUND',
              `Subgraph “${operation.subgraphId}” has no ${operation.capability} capability override.`,
              `operations.${index}.capability`,
            ),
          );
        } else {
          const remaining = { ...current };
          delete remaining[operation.capability];
          const updated = { ...next.subgraphs[subgraphIndex] };
          if (Object.keys(remaining).length > 0) updated.capabilityOverrides = remaining;
          else delete updated.capabilityOverrides;
          next.subgraphs[subgraphIndex] = updated;
        }
      }
    } else if (operation.type === 'assign_nodes_to_subgraph') {
      if (!hasSubgraph(operation.subgraphId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}`));
      } else if (!missingNodes(operation.nodeIds, index)) {
        const target = next.subgraphs.find((subgraph) => subgraph.id === operation.subgraphId)!;
        const requested = new Set(uniqueNodeIds(operation.nodeIds));
        next.nodes = next.nodes.map((node) => {
          if (!requested.has(node.id)) return node;
          const absolute = absoluteNodePosition(node);
          return {
            ...node,
            parentId: operation.subgraphId,
            position: {
              x: absolute.x - target.position.x,
              y: absolute.y - target.position.y,
            },
          };
        });
      }
    } else if (operation.type === 'remove_nodes_from_subgraph') {
      if (!missingNodes(operation.nodeIds, index)) {
        const requested = new Set(uniqueNodeIds(operation.nodeIds));
        next.nodes = next.nodes.map((node) => {
          if (!requested.has(node.id) || !node.parentId) return node;
          const position = absoluteNodePosition(node);
          const unparented = { ...node };
          delete unparented.parentId;
          return { ...unparented, position };
        });
      }
    } else if (operation.type === 'dissolve_subgraph') {
      if (!hasSubgraph(operation.subgraphId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes = next.nodes.map((node) => {
          if (node.parentId !== operation.subgraphId) return node;
          const position = absoluteNodePosition(node);
          const unparented = { ...node };
          delete unparented.parentId;
          return { ...unparented, position };
        });
        // Edges remain canonical node-to-node edges. Only the container is
        // removed, after direct children have been converted to screen space.
        next.subgraphs = next.subgraphs.filter((subgraph) => subgraph.id !== operation.subgraphId);
      }
    } else if (operation.type === 'add_edge') {
      if (
        next.edges.some((edge) => edge.id === operation.edge.id) ||
        next.relationships.some((relationship) => relationship.id === operation.edge.id)
      ) {
        errors.push(issue('OPERATION_CONFLICT', `Edge “${operation.edge.id}” already exists.`, `operations.${index}`));
      } else if (!findNode(operation.edge.source) || !findNode(operation.edge.target)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edge.id}” references a node that was not found.`, `operations.${index}`));
      } else {
        next.edges.push(normalizeRoutingEdge(structuredClone(operation.edge)));
      }
    } else if (operation.type === 'update_edge') {
      const edgeIndex = next.edges.findIndex((edge) => edge.id === operation.edgeId);
      if (edgeIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” was not found.`, `operations.${index}`));
      } else {
        const updated = normalizeRoutingEdge({
          ...next.edges[edgeIndex],
          ...structuredClone(operation.patch),
        } as GraphEdge);
        if (!findNode(updated.source) || !findNode(updated.target)) {
          errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” references a node that was not found.`, `operations.${index}`));
        } else {
          next.edges[edgeIndex] = updated;
        }
      }
    } else if (operation.type === 'remove_edge') {
      if (!next.edges.some((edge) => edge.id === operation.edgeId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” was not found.`, `operations.${index}`));
      } else {
        next.edges = next.edges.filter((edge) => edge.id !== operation.edgeId);
      }
    } else if (operation.type === 'add_relationship') {
      if (
        next.relationships.some((relationship) => relationship.id === operation.relationship.id) ||
        next.edges.some((edge) => edge.id === operation.relationship.id)
      ) {
        errors.push(issue('OPERATION_CONFLICT', `Relationship “${operation.relationship.id}” already exists.`, `operations.${index}`));
      } else if (relationshipReferencesMissingNode(operation.relationship, index)) {
        // Relationship endpoints resolve progressively but never become edges.
      } else {
        next.relationships.push(structuredClone(operation.relationship));
      }
    } else if (operation.type === 'update_relationship') {
      const relationshipIndex = next.relationships.findIndex(
        (relationship) => relationship.id === operation.relationshipId,
      );
      if (relationshipIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Relationship “${operation.relationshipId}” was not found.`, `operations.${index}`));
      } else {
        const updated = {
          ...next.relationships[relationshipIndex],
          ...structuredClone(operation.patch),
        };
        if (!relationshipReferencesMissingNode(updated, index)) {
          next.relationships[relationshipIndex] = updated;
        }
      }
    } else if (operation.type === 'remove_relationship') {
      if (!next.relationships.some((relationship) => relationship.id === operation.relationshipId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Relationship “${operation.relationshipId}” was not found.`, `operations.${index}`));
      } else {
        next.relationships = next.relationships.filter(
          (relationship) => relationship.id !== operation.relationshipId,
        );
      }
    }
  }

  return { graph: normalizeWorkflowGraph(next), errors };
}

export function proposalDiff(operations: GraphOperation[], baseGraph?: WorkflowGraph): ProposalDiff {
  const diff: ProposalDiff = {
    addedNodeIds: [],
    updatedNodeIds: [],
    removedNodeIds: [],
    addedSubgraphIds: [],
    updatedSubgraphIds: [],
    removedSubgraphIds: [],
    membershipChangedNodeIds: [],
    addedEdgeIds: [],
    updatedEdgeIds: [],
    removedEdgeIds: [],
    addedRelationshipIds: [],
    updatedRelationshipIds: [],
    removedRelationshipIds: [],
    changedCapabilityPaths: [],
    changedProvenancePaths: [],
    changedReadinessNodeIds: [],
    changedOpaqueNodeIds: [],
    changedEndOutcomeNodeIds: [],
  };
  const add = (values: string[], value: string) => {
    if (!values.includes(value)) values.push(value);
  };
  const addCapabilityPath = (value: string) => add(diff.changedCapabilityPaths, value);
  const addProvenancePath = (value: string) => add(diff.changedProvenancePaths, value);
  let candidate = baseGraph ? structuredClone(baseGraph) : undefined;

  for (const operation of operations) {
    if (operation.type === 'add_node') {
      add(diff.addedNodeIds, operation.node.id);
      if (operation.node.parentId) add(diff.membershipChangedNodeIds, operation.node.id);
    }
    if (operation.type === 'update_node') {
      add(diff.updatedNodeIds, operation.nodeId);
      if ('provenance' in operation.patch) addProvenancePath(`nodes.${operation.nodeId}.provenance`);
      if ('readiness' in operation.patch) add(diff.changedReadinessNodeIds, operation.nodeId);
      if ('opaque' in operation.patch) add(diff.changedOpaqueNodeIds, operation.nodeId);
      if ('outcome' in operation.patch) add(diff.changedEndOutcomeNodeIds, operation.nodeId);
    }
    if (operation.type === 'remove_node') add(diff.removedNodeIds, operation.nodeId);
    if (operation.type === 'add_subgraph') add(diff.addedSubgraphIds, operation.subgraph.id);
    if (operation.type === 'update_subgraph') add(diff.updatedSubgraphIds, operation.subgraphId);
    if (operation.type === 'update_graph_capabilities') {
      for (const capability of Object.keys(operation.patch) as Array<keyof GraphCapabilities>) {
        addCapabilityPath(`capabilities.${capability}`);
        if (capability === 'provenance') addProvenancePath('capabilities.provenance');
      }
    }
    if (operation.type === 'set_subgraph_capability_override') {
      for (const capability of Object.keys(operation.override) as Array<keyof GraphCapabilityOverrides>) {
        add(diff.updatedSubgraphIds, operation.subgraphId);
        addCapabilityPath(`subgraphs.${operation.subgraphId}.capabilityOverrides.${capability}`);
      }
    }
    if (operation.type === 'remove_subgraph_capability_override') {
      add(diff.updatedSubgraphIds, operation.subgraphId);
      addCapabilityPath(`subgraphs.${operation.subgraphId}.capabilityOverrides.${operation.capability}`);
    }
    if (operation.type === 'dissolve_subgraph') {
      add(diff.removedSubgraphIds, operation.subgraphId);
      for (const node of candidate?.nodes ?? []) {
        if (node.parentId === operation.subgraphId) add(diff.membershipChangedNodeIds, node.id);
      }
    }
    if (operation.type === 'assign_nodes_to_subgraph' || operation.type === 'remove_nodes_from_subgraph') {
      for (const nodeId of operation.nodeIds) add(diff.membershipChangedNodeIds, nodeId);
    }
    if (operation.type === 'add_edge') add(diff.addedEdgeIds, operation.edge.id);
    if (operation.type === 'update_edge') {
      add(diff.updatedEdgeIds, operation.edgeId);
      if ('provenance' in operation.patch) addProvenancePath(`edges.${operation.edgeId}.provenance`);
    }
    if (operation.type === 'remove_edge') add(diff.removedEdgeIds, operation.edgeId);
    if (operation.type === 'add_relationship') {
      add(diff.addedRelationshipIds, operation.relationship.id);
      addProvenancePath(`relationships.${operation.relationship.id}.provenance`);
    }
    if (operation.type === 'update_relationship') {
      add(diff.updatedRelationshipIds, operation.relationshipId);
      if ('provenance' in operation.patch) {
        addProvenancePath(`relationships.${operation.relationshipId}.provenance`);
      }
    }
    if (operation.type === 'remove_relationship') add(diff.removedRelationshipIds, operation.relationshipId);

    if (candidate) candidate = applyGraphOperations(candidate, [operation]).graph;
  }

  return diff;
}

export function createProposal(
  graph: WorkflowGraph,
  input: unknown,
): { proposal?: GraphProposal; error?: { code: string; message: string; issues?: ValidationIssue[] } } {
  const parsed = proposalInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: {
        code: 'INVALID_INPUT',
        message: 'The proposal input does not match the GraphContract operation schema.',
        issues: parsed.error.issues.map((entry) =>
          issue('INVALID_INPUT', entry.message, entry.path.join('.')),
        ),
      },
    };
  }

  if (graph.status === 'frozen') {
    return { error: { code: 'GRAPH_FROZEN', message: 'Unfreeze the graph before requesting changes.' } };
  }
  if (
    parsed.data.expectedGraphUpdatedAt &&
    parsed.data.expectedGraphUpdatedAt !== graph.updatedAt
  ) {
    return { error: { code: 'PROPOSAL_STALE', message: 'The accepted graph changed. Read it again before proposing changes.' } };
  }

  const applied = applyGraphOperations(graph, parsed.data.operations);
  const validationErrors = [...applied.errors, ...validateGraph(applied.graph)];
  const now = new Date().toISOString();
  return {
    proposal: {
      id: `proposal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      baseGraphId: graph.id,
      baseUpdatedAt: graph.updatedAt,
      operations: parsed.data.operations,
      rationale: parsed.data.rationale,
      status: validationErrors.length === 0 ? 'pending' : 'invalid',
      createdAt: now,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      diff: proposalDiff(parsed.data.operations, graph),
    },
  };
}

export function enumerateScenarios(graph: WorkflowGraph): BranchScenario[] {
  if (validateGraph(graph).length > 0) return [];
  const normalized = normalizeWorkflowGraph(workflowGraphSchema.parse(graph));
  const start = normalized.nodes.find((node) => node.kind === 'start' && !node.parentId);
  if (!start) return [];

  const nodeMap = new Map(normalized.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of normalized.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  for (const edges of outgoing.values()) {
    edges.sort(compareEdges);
  }

  const loopEdgeIds = new Set(deriveTopologyLoops(start.id, outgoing).map((loop) => loop.loopEdgeId));

  const scenarios: BranchScenario[] = [];
  const walk = (
    nodeId: string,
    path: string[],
    conditions: BranchCondition[],
    humanOutcomes: ScenarioHumanOutcome[],
    traversedEdges: ScenarioEdge[],
    dynamicSends: ScenarioDynamicSend[],
    merges: ScenarioMerge[],
    traversedLoopCounts: ReadonlyMap<string, number>,
  ) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const nextPath = [...path, nodeId];
    const nextMerges =
      node.kind === 'merge'
        ? [
            ...merges,
            {
              nodeId: node.id,
              reducer: node.merge.reducer,
              completion: node.merge.completion,
              continuation: node.merge.continuation,
              waitingForDynamicInputs: true as const,
            },
          ]
        : merges;
    if (node.kind === 'end' && !node.parentId) {
      const number = scenarios.length + 1;
      const humanOutcomeSuffix = humanOutcomes.length
        ? ` [${humanOutcomes.map((outcome) => outcome.outcomeLabel).join(', ')}]`
        : '';
      const pathNodeIds = new Set(nextPath);
      const relationshipAnnotations: ScenarioRelationshipAnnotation[] = [
        ...traversedEdges.map((edge) => ({
          family: 'native-control' as const,
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          mode: edge.mode,
          provenance: edge.provenance ?? declaredProvenance(),
        })),
        ...normalized.relationships
          .filter(
            (relationship) =>
              (relationship.source.kind === 'node' && pathNodeIds.has(relationship.source.nodeId)) ||
              (relationship.target.kind === 'node' && pathNodeIds.has(relationship.target.nodeId)),
          )
          .slice()
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((relationship) => ({
            family:
              relationship.kind === 'external-orchestration'
                ? ('external-orchestration' as const)
                : ('spawned' as const),
            relationshipId: relationship.id,
            kind: relationship.kind,
            source: structuredClone(relationship.source),
            target: structuredClone(relationship.target),
            provenance: structuredClone(relationship.provenance),
          })),
      ];
      scenarios.push({
        id: `scenario-${number}`,
        name: `Path ${number}: ${nextPath.map((id) => nodeMap.get(id)?.label ?? id).join(' → ')}${humanOutcomeSuffix}`,
        triggeringConditions: conditions,
        humanOutcomes,
        traversedEdges,
        dynamicSends,
        merges: nextMerges,
        relationshipAnnotations,
        orderedPath: nextPath,
        expectedNodes: nextPath,
        expectedTerminalNode: nodeId,
        expectedTerminalOutcome: node.outcome ?? normalizeLegacyEndOutcome(node.label),
      });
      return;
    }

    const response = node.kind === 'step' && (node as StepGraphNode).hitl?.enabled
      ? (node as StepGraphNode).hitl?.response
      : undefined;
    const choices = response
      ? response.allowedOutcomes
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id))
          .flatMap((outcome) =>
            (outgoing.get(nodeId) ?? [])
              .filter((edge) => edge.target === outcome.resumeNodeId)
              .map((edge) => ({ edge, outcome })),
          )
      : (outgoing.get(nodeId) ?? []).map((edge) => ({ edge, outcome: undefined }));

    for (const { edge, outcome } of choices) {
      const isLoop = loopEdgeIds.has(edge.id);
      const loopCap = edge.loopCap ?? 1;
      const loopCount = traversedLoopCounts.get(edge.id) ?? 0;
      if (isLoop && loopCount >= loopCap) continue;
      const scenarioEdge: ScenarioEdge = {
        ...edge,
        isLoop: isLoop || undefined,
        isFallback: edge.mode === 'fallback' || undefined,
      };
      const branch =
        edge.mode === 'normal' || edge.mode === 'send'
          ? conditions
          : [
              ...conditions,
              {
                nodeId,
                nodeLabel: node.label,
                edgeId: edge.id,
                mode: edge.mode,
                label: edge.label || (edge.mode === 'fallback' ? 'fallback' : 'condition'),
                condition: edge.condition,
                isFallback: edge.mode === 'fallback' || undefined,
              },
            ];
      const nextTraversedLoopCounts = isLoop
        ? new Map([...traversedLoopCounts, [edge.id, loopCount + 1]])
        : traversedLoopCounts;
      const nextHumanOutcomes =
        outcome && response
          ? [
              ...humanOutcomes,
              {
                nodeId,
                nodeLabel: node.label,
                timing: (node as StepGraphNode).hitl!.timing!,
                responseType: response.type,
                outcomeId: outcome.id,
                outcomeLabel: outcome.label,
                resumeNodeId: outcome.resumeNodeId,
              },
            ]
          : humanOutcomes;
      const nextDynamicSends =
        edge.mode === 'send' && edge.send
          ? [
              ...dynamicSends,
              {
                edgeId: edge.id,
                sourceNodeId: edge.source,
                templateNodeId: edge.target,
                destinationTemplateId: edge.send.destinationTemplateId,
                multiplicity: edge.send.multiplicity,
                payloadLabel: edge.send.payloadLabel,
                mergeNodeId: edge.send.mergeNodeId,
                ...(edge.send.payloadSchemaRef ? { payloadSchemaRef: edge.send.payloadSchemaRef } : {}),
              },
            ]
          : dynamicSends;
      walk(
        edge.target,
        nextPath,
        branch,
        nextHumanOutcomes,
        [...traversedEdges, scenarioEdge],
        nextDynamicSends,
        nextMerges,
        nextTraversedLoopCounts,
      );
    }
  };

  walk(start.id, [], [], [], [], [], [], new Map());
  return scenarios;
}

export function buildPythonTestSkeleton(
  graph: WorkflowGraph,
  scenarios: BranchScenario[],
): string {
  const normalized = normalizeWorkflowGraph(graph);
  const payload = JSON.stringify(scenarios, null, 2)
    .split('\n')
    .map((line) => `# ${line}`)
    .join('\n');

  return `"""Generated GraphContract path-test skeleton for ${normalized.name}."""

import pytest


${payload}


GRAPH_METADATA = ${JSON.stringify(
    {
      schema_version: normalized.schemaVersion,
      capabilities: normalized.capabilities,
      relationships: normalized.relationships,
      subgraph_capability_overrides: normalized.subgraphs.map((subgraph) => ({
        subgraph_id: subgraph.id,
        ...(subgraph.capabilityOverrides
          ? { capability_overrides: subgraph.capabilityOverrides }
          : {}),
      })),
    },
    null,
  )
    .replace(/true/g, 'True')
    .replace(/false/g, 'False')
    .replace(/null/g, 'None')}


SCENARIOS = ${JSON.stringify(
    scenarios.map((scenario) => ({
      id: scenario.id,
      path: scenario.orderedPath,
      terminal: scenario.expectedTerminalNode,
      terminal_outcome: scenario.expectedTerminalOutcome,
      relationship_annotations: scenario.relationshipAnnotations,
      human_outcomes: scenario.humanOutcomes.map((outcome) => ({
        node_id: outcome.nodeId,
        outcome_id: outcome.outcomeId,
        resume_node_id: outcome.resumeNodeId,
      })),
      dynamic_sends: scenario.dynamicSends.map((send) => ({
        edge_id: send.edgeId,
        template_node_id: send.templateNodeId,
        destination_template_id: send.destinationTemplateId,
        multiplicity: send.multiplicity,
        payload_label: send.payloadLabel,
        payload_schema_ref: send.payloadSchemaRef ?? null,
        merge_node_id: send.mergeNodeId,
      })),
      merges: scenario.merges.map((merge) => ({
        node_id: merge.nodeId,
        reducer: merge.reducer,
        completion: merge.completion,
        continuation: merge.continuation,
      })),
    })),
    null,
    2,
  )
    .replace(/true/g, 'True')
    .replace(/false/g, 'False')
    .replace(/null/g, 'None')}


@pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda item: item["id"])
def test_graph_path_contract(scenario):
    """Replace this placeholder with your compiled LangGraph invocation."""
    observed_path = scenario["path"]
    assert observed_path == scenario["path"]
    assert observed_path[-1] == scenario["terminal"]
`;
}
