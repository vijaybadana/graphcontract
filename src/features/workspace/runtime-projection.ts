import {
  type RuntimeProjectionFixture,
  type WorkflowGraph,
  validateRuntimeProjectionFixture,
} from '@/src/domain';

export type { RuntimeProjectionFixture } from '@/src/domain';

/**
 * Runtime evidence is deliberately outside WorkspaceCore and the persisted
 * graph. This contract is validated at the canvas boundary before it may be
 * projected into React Flow.
 */
export type RuntimeProjectionAvailability =
  | { available: true; fixture: RuntimeProjectionFixture }
  | { available: false; reason: string };

export function runtimeProjectionAvailability(
  graph: WorkflowGraph,
  fixture: RuntimeProjectionFixture | null | undefined,
): RuntimeProjectionAvailability {
  if (!fixture) return { available: false, reason: 'No runtime trace or fixture is available.' };
  const issues = validateRuntimeProjectionFixture(fixture, graph);
  if (issues.length > 0) {
    return { available: false, reason: issues[0].message };
  }
  return { available: true, fixture };
}
