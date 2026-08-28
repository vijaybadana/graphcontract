import { WorkspaceCore } from '@/src/application/workspace';
import { validateGraph } from '@/src/domain';

type PersistedWorkspace = Partial<WorkspaceCore> & Record<string, unknown>;

/** Repairs the hackathon demo snapshot without mixing persistence concerns into
 * domain validation or deleting valid user-authored workflows. */
export function migrateWorkspaceV2(
  persistedState: unknown,
  createInitial: () => WorkspaceCore,
): PersistedWorkspace {
  const persisted = persistedState as PersistedWorkspace;
  if (!persisted.graph || validateGraph(persisted.graph).length > 0) {
    return createInitial();
  }

  return {
    ...persisted,
    graph: {
      ...persisted.graph,
      nodes: persisted.graph.nodes.map((node) =>
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
