import { WorkspaceCore } from '@/src/application/workspace';
import {
  enumerateScenariosBounded,
  graphEdgeSchema,
  graphEdgeV3Schema,
  graphNodeSchema,
  graphNodeV2Schema,
  hitlV2Schema,
  legacyGraphNodeV1Schema,
  legacySensitiveEffectPolicy,
  legacyNodeKinds,
  migrateGraphNodeV2,
  migrateGraphNodeV5,
  migrateHitlConfigV2,
  migrateLegacyGraphNodeV1,
  migrateWorkflowGraphV1,
  migrateWorkflowGraphV2,
  migrateWorkflowGraphV3,
  migrateWorkflowGraphV4,
  migrateWorkflowGraphV5,
  migrateGraphEdgeV5,
  normalizeLegacyWorkNodeKind,
  normalizeWorkflowGraph,
  ProposalDiff,
  validateGraph,
  workflowGraphSchema,
  workflowGraphV5Schema,
  workflowGraphV4Schema,
  workflowGraphV3Schema,
  workflowGraphV2Schema,
  workflowGraphV1Schema,
  WorkflowGraph,
  WorkflowGraphV2,
} from '@/src/domain';

type PersistedWorkspace = Partial<WorkspaceCore> & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const proposalDiffArrayKeys = [
  'addedNodeIds',
  'updatedNodeIds',
  'removedNodeIds',
  'addedSubgraphIds',
  'updatedSubgraphIds',
  'removedSubgraphIds',
  'membershipChangedNodeIds',
  'addedEdgeIds',
  'updatedEdgeIds',
  'removedEdgeIds',
  'addedRelationshipIds',
  'updatedRelationshipIds',
  'removedRelationshipIds',
  'changedCapabilityPaths',
  'changedProvenancePaths',
  'changedReadinessNodeIds',
  'changedOpaqueNodeIds',
  'changedEndOutcomeNodeIds',
] as const satisfies readonly (keyof ProposalDiff)[];

/**
 * Old persisted proposals have no reliable view of the graph against which
 * their diff was originally calculated. Preserve known arrays and complete
 * the active shape rather than deriving potentially stale proposal changes.
 */
function normalizeProposalDiff(proposal: Record<string, unknown>): Record<string, unknown> {
  const persistedDiff = isRecord(proposal.diff) ? proposal.diff : {};
  const normalizedDiff = Object.fromEntries(
    proposalDiffArrayKeys.map((key) => [key, Array.isArray(persistedDiff[key]) ? persistedDiff[key] : []]),
  );

  return {
    ...proposal,
    diff: {
      ...persistedDiff,
      ...normalizedDiff,
    },
  };
}

/**
 * A pending v1 proposal is part of ordinary restoration state. Normalize only
 * its legacy work-node operations; malformed operations remain for the
 * proposal validator to reject rather than being silently discarded.
 */
function migrateV1Proposal(proposal: unknown): unknown {
  if (!isRecord(proposal) || !Array.isArray(proposal.operations)) return proposal;

  return {
    ...proposal,
    operations: proposal.operations.map((operation) => {
      if (!isRecord(operation)) return operation;

      if (operation.type === 'add_node') {
        const node = legacyGraphNodeV1Schema.safeParse(operation.node);
        return node.success ? { ...operation, node: migrateLegacyGraphNodeV1(node.data) } : operation;
      }

      if (operation.type !== 'update_node' || !isRecord(operation.patch)) return operation;
      const kind = operation.patch.kind;
      if (typeof kind !== 'string' || !legacyNodeKinds.includes(kind as (typeof legacyNodeKinds)[number])) {
        return operation;
      }

      const config = isRecord(operation.patch.config) ? operation.patch.config : undefined;
      const legacyPatch = Object.fromEntries(
        Object.entries(operation.patch).filter(([field]) => field !== 'kind'),
      );
      const normalized = normalizeLegacyWorkNodeKind(
        kind as (typeof legacyNodeKinds)[number],
        config,
      );
      const normalizedPatch = {
        executor: normalized.executor,
        ...(normalized.participation ? { participation: normalized.participation } : {}),
      };
      return {
        ...operation,
        patch: {
          ...legacyPatch,
          ...normalizedPatch,
        },
      };
    }),
  };
}

/**
 * Pending proposals are persisted review state. Upgrade only recognizable v2
 * Step payloads; malformed operations remain intact for proposal validation
 * instead of being discarded during draft rehydration.
 */
function migrateV2Proposal(proposal: unknown, graph: WorkflowGraphV2): unknown {
  const v1Normalized = migrateV1Proposal(proposal);
  if (!isRecord(v1Normalized) || !Array.isArray(v1Normalized.operations)) return v1Normalized;
  const proposalGraph: WorkflowGraphV2 = {
    ...graph,
    nodes: [
      ...graph.nodes,
      ...v1Normalized.operations.flatMap((operation) => {
        if (!isRecord(operation) || operation.type !== 'add_node') return [];
        const node = graphNodeV2Schema.safeParse(operation.node);
        return node.success ? [node.data] : [];
      }),
    ],
    edges: [
      ...graph.edges,
      ...v1Normalized.operations.flatMap((operation) => {
        if (!isRecord(operation) || operation.type !== 'add_edge') return [];
        const edge = graphEdgeV3Schema.safeParse(operation.edge);
        return edge.success ? [edge.data] : [];
      }),
    ],
  };

  return {
    ...v1Normalized,
    operations: v1Normalized.operations.map((operation) => {
      if (!isRecord(operation)) return operation;

      if (operation.type === 'add_node') {
        const node = graphNodeV2Schema.safeParse(operation.node);
        return node.success ? { ...operation, node: migrateGraphNodeV2(node.data, proposalGraph) } : operation;
      }

      if (operation.type !== 'update_node' || !isRecord(operation.patch)) return operation;
      const patch = { ...operation.patch };
      if ('hitl' in patch && typeof operation.nodeId === 'string') {
        const hitl = hitlV2Schema.safeParse(patch.hitl);
        if (hitl.success) patch.hitl = migrateHitlConfigV2(hitl.data, operation.nodeId, proposalGraph);
      }
      if (isRecord(patch.modifiers) && patch.modifiers.sensitiveSideEffect === true) {
        const modifiers = { ...patch.modifiers };
        delete modifiers.sensitiveSideEffect;
        patch.modifiers = Object.keys(modifiers).length > 0 ? modifiers : undefined;
        patch.sensitive = { ...legacySensitiveEffectPolicy };
      }
      return { ...operation, patch };
    }),
  };
}

/**
 * Pending v5 proposals remain review-only data. Upgrade recognized element
 * payloads to declared v6 records without manufacturing evidence, topology,
 * relationships, or runtime inspection traces.
 */
function migrateV5Proposal(proposal: unknown): unknown {
  if (!isRecord(proposal) || !Array.isArray(proposal.operations)) return proposal;
  const normalizedProposal = normalizeProposalDiff(proposal);

  return {
    ...normalizedProposal,
    operations: proposal.operations.map((operation) => {
      if (!isRecord(operation)) return operation;
      if (operation.type === 'add_node') {
        const node = graphNodeSchema.safeParse(operation.node);
        return node.success ? { ...operation, node: migrateGraphNodeV5(node.data) } : operation;
      }
      if (operation.type === 'add_edge') {
        const edge = graphEdgeSchema.safeParse(operation.edge);
        return edge.success ? { ...operation, edge: migrateGraphEdgeV5(edge.data) } : operation;
      }
      return operation;
    }),
  };
}

/**
 * Scenarios are a deterministic projection of one accepted frozen revision,
 * never persistence authority. Discard saved arrays and rebuild only when the
 * canonical graph is both frozen and valid.
 */
function restoreWorkspaceProjection(
  persisted: PersistedWorkspace,
  graph: WorkflowGraph,
  proposal: unknown = persisted.proposal,
): PersistedWorkspace {
  const normalizedGraph = normalizeWorkflowGraph(graph);
  const enumeration =
    normalizedGraph.status === 'frozen' && validateGraph(normalizedGraph).length === 0
      ? enumerateScenariosBounded(normalizedGraph)
      : null;
  return {
    ...persisted,
    graph: normalizedGraph,
    proposal: proposal as WorkspaceCore['proposal'],
    scenarios: enumeration?.ok ? enumeration.scenarios : [],
  };
}

/** Repairs the hackathon demo snapshot without mixing persistence concerns into
 * domain validation or deleting valid user-authored workflows. */
export function migrateWorkspaceV7(
  persistedState: unknown,
  createInitial: () => WorkspaceCore,
): PersistedWorkspace {
  if (!persistedState || typeof persistedState !== 'object' || Array.isArray(persistedState)) {
    return createInitial();
  }

  const persisted = persistedState as PersistedWorkspace;
  const parsed = workflowGraphSchema.safeParse(persisted.graph);
  // Rehydration only decides whether the saved shape is recoverable. A draft
  // may legitimately be incomplete while its author is still editing it;
  // canonical validation remains the ordinary derived contract-status signal.
  if (parsed.success) {
    return restoreWorkspaceProjection(persisted, parsed.data);
  }

  const v5 = workflowGraphV5Schema.safeParse(persisted.graph);
  if (v5.success) {
    return restoreWorkspaceProjection(
      persisted,
      migrateWorkflowGraphV5(v5.data),
      migrateV5Proposal(persisted.proposal),
    );
  }

  const v4 = workflowGraphV4Schema.safeParse(persisted.graph);
  if (v4.success) {
    return restoreWorkspaceProjection(
      persisted,
      migrateWorkflowGraphV4(v4.data),
      migrateV5Proposal(persisted.proposal),
    );
  }

  const v3 = workflowGraphV3Schema.safeParse(persisted.graph);
  if (v3.success) {
    return restoreWorkspaceProjection(
      persisted,
      migrateWorkflowGraphV3(v3.data),
      migrateV5Proposal(persisted.proposal),
    );
  }

  const v2 = workflowGraphV2Schema.safeParse(persisted.graph);
  if (v2.success) {
    return restoreWorkspaceProjection(
      persisted,
      migrateWorkflowGraphV2(v2.data),
      migrateV5Proposal(migrateV2Proposal(persisted.proposal, v2.data)),
    );
  }

  const legacy = workflowGraphV1Schema.safeParse(persisted.graph);
  if (!legacy.success) return createInitial();
  const v2Graph = migrateWorkflowGraphV1(legacy.data);

  return restoreWorkspaceProjection(
    persisted,
    migrateWorkflowGraphV2(v2Graph),
    migrateV5Proposal(migrateV2Proposal(persisted.proposal, v2Graph)),
  );
}

/** Compatibility aliases retain old import paths while producing active v6 data. */
export const migrateWorkspaceV6 = migrateWorkspaceV7;
export const migrateWorkspaceV5 = migrateWorkspaceV7;
export const migrateWorkspaceV4 = migrateWorkspaceV7;
export const migrateWorkspaceV3 = migrateWorkspaceV7;
export const migrateWorkspaceV2 = migrateWorkspaceV7;
