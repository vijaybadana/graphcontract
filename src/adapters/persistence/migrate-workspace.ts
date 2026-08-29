import { WorkspaceCore } from '@/src/application/workspace';
import {
  legacyGraphNodeV1Schema,
  legacyNodeKinds,
  migrateLegacyGraphNodeV1,
  migrateWorkflowGraphV1,
  normalizeLegacyWorkNodeKind,
  normalizeWorkflowGraphRouting,
  workflowGraphSchema,
  workflowGraphV1Schema,
} from '@/src/domain';

type PersistedWorkspace = Partial<WorkspaceCore> & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * A pending v1 proposal is part of ordinary restoration state. Normalize only
 * its legacy work-node operations; malformed operations remain for the
 * proposal validator to reject rather than being silently discarded.
 */
function migrateLegacyProposal(proposal: unknown): unknown {
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

/** Repairs the hackathon demo snapshot without mixing persistence concerns into
 * domain validation or deleting valid user-authored workflows. */
export function migrateWorkspaceV3(
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

  const legacy = workflowGraphV1Schema.safeParse(persisted.graph);
  if (!legacy.success) return createInitial();

  return {
    ...persisted,
    graph: migrateWorkflowGraphV1(legacy.data),
    proposal: migrateLegacyProposal(persisted.proposal) as WorkspaceCore['proposal'],
  };
}

/** Kept for callers that imported the previous migration directly. */
export const migrateWorkspaceV2 = migrateWorkspaceV3;
