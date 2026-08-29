import { WorkspaceCore } from '@/src/application/workspace';
import { validateGraph, workflowGraphSchema } from '@/src/domain';

type PersistedWorkspace = Partial<WorkspaceCore> & Record<string, unknown>;

/** Repairs the hackathon demo snapshot without mixing persistence concerns into
 * domain validation or deleting valid user-authored workflows. */
export function migrateWorkspaceV3(
  persistedState: unknown,
  createInitial: () => WorkspaceCore,
): PersistedWorkspace {
  const persisted = persistedState as PersistedWorkspace;
  const parsed = workflowGraphSchema.safeParse(persisted.graph);
  if (!parsed.success || validateGraph(parsed.data).length > 0) {
    return createInitial();
  }

  return {
    ...persisted,
    graph: {
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
    },
  };
}

/** Kept for callers that imported the previous migration directly. */
export const migrateWorkspaceV2 = migrateWorkspaceV3;
