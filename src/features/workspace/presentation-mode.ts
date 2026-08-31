export type WorkspacePresentationMode = 'design' | 'scenario' | 'proposal' | 'runtime';

export type WorkspacePresentationAvailability = {
  scenarioCount: number;
  proposalPending: boolean;
  runtimeAvailable: boolean;
};

/**
 * Resolves a requested canvas presentation without creating another graph state.
 * Scenario, proposal, and runtime are read-only projections over the accepted
 * contract; Design is the deterministic fallback when their evidence vanishes.
 */
export function resolveWorkspacePresentationMode(
  requested: WorkspacePresentationMode,
  availability: WorkspacePresentationAvailability,
): WorkspacePresentationMode {
  if (availability.proposalPending) return 'proposal';
  if (requested === 'proposal') return 'design';
  if (requested === 'scenario' && availability.scenarioCount === 0) return 'design';
  if (requested === 'runtime' && !availability.runtimeAvailable) return 'design';
  return requested;
}

export function presentationModeAvailable(
  mode: WorkspacePresentationMode,
  availability: WorkspacePresentationAvailability,
): boolean {
  if (mode === 'design') return !availability.proposalPending;
  if (mode === 'proposal') return availability.proposalPending;
  if (mode === 'scenario') return availability.scenarioCount > 0 && !availability.proposalPending;
  return availability.runtimeAvailable && !availability.proposalPending;
}
