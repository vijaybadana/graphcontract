import { WorkspaceCore } from '@/src/application/workspace';
import {
  graphEdgeSchema,
  graphNodeV2Schema,
  hitlV2Schema,
  legacyGraphNodeV1Schema,
  legacySensitiveEffectPolicy,
  legacyNodeKinds,
  migrateGraphNodeV2,
  migrateHitlConfigV2,
  migrateLegacyGraphNodeV1,
  migrateWorkflowGraphV1,
  migrateWorkflowGraphV2,
  normalizeLegacyWorkNodeKind,
  normalizeWorkflowGraphRouting,
  workflowGraphSchema,
  workflowGraphV2Schema,
  workflowGraphV1Schema,
  WorkflowGraphV2,
} from '@/src/domain';

type PersistedWorkspace = Partial<WorkspaceCore> & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

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
        const edge = graphEdgeSchema.safeParse(operation.edge);
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
      if ('hitl' in patch) {
        const hitl = hitlV2Schema.safeParse(patch.hitl);
        if (hitl.success) patch.hitl = migrateHitlConfigV2(hitl.data, operation.nodeId, proposalGraph);
      }
      if (isRecord(patch.modifiers) && patch.modifiers.sensitiveSideEffect === true) {
        const { sensitiveSideEffect: _legacySensitive, ...modifiers } = patch.modifiers;
        patch.modifiers = Object.keys(modifiers).length > 0 ? modifiers : undefined;
        patch.sensitive = { ...legacySensitiveEffectPolicy };
      }
      return { ...operation, patch };
    }),
  };
}

/** Repairs the hackathon demo snapshot without mixing persistence concerns into
 * domain validation or deleting valid user-authored workflows. */
export function migrateWorkspaceV4(
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
    return {
      ...persisted,
      graph: normalizeWorkflowGraphRouting(parsed.data),
    };
  }

  const v2 = workflowGraphV2Schema.safeParse(persisted.graph);
  if (v2.success) {
    return {
      ...persisted,
      graph: migrateWorkflowGraphV2(v2.data),
      proposal: migrateV2Proposal(persisted.proposal, v2.data) as WorkspaceCore['proposal'],
    };
  }

  const legacy = workflowGraphV1Schema.safeParse(persisted.graph);
  if (!legacy.success) return createInitial();
  const v2Graph = migrateWorkflowGraphV1(legacy.data);

  return {
    ...persisted,
    graph: migrateWorkflowGraphV2(v2Graph),
    proposal: migrateV2Proposal(persisted.proposal, v2Graph) as WorkspaceCore['proposal'],
  };
}

/** Compatibility aliases for callers that imported the Package 1 migration. */
export const migrateWorkspaceV3 = migrateWorkspaceV4;
export const migrateWorkspaceV2 = migrateWorkspaceV4;
