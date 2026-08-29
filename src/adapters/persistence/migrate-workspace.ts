import { WorkspaceCore } from '@/src/application/workspace';
import { normalizeWorkflowGraphRouting, workflowGraphSchema } from '@/src/domain';

type PersistedWorkspace = Partial<WorkspaceCore> & Record<string, unknown>;

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
  if (!parsed.success) {
    return createInitial();
  }

  return {
    ...persisted,
    graph: normalizeWorkflowGraphRouting({
      ...parsed.data,
      nodes: parsed.data.nodes.map((node) =>
        node.label === 'New Action'
          ? {
              ...node,
              label: 'Post-Refund Audit',
              description:
                node.description || 'Record completion details after the refund executes.',
            }
          : node,
      ),
    }),
  };
}

/** Kept for callers that imported the previous migration directly. */
export const migrateWorkspaceV2 = migrateWorkspaceV3;
