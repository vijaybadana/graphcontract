export type CompactPanelPreference = 'palette' | 'inspector' | null;

export type WorkspacePanelVisibility = {
  inspectorVisible: boolean;
  paletteVisible: boolean;
};

/**
 * Panel visibility is entirely request-driven. Proposal arrival opens the
 * inspector through the workspace transition handler; keeping that policy out
 * of this resolver lets a later explicit collapse remain collapsed.
 */
export function resolveWorkspacePanelVisibility({
  compact,
  paletteRequested,
  inspectorRequested,
  compactPreference,
}: {
  compact: boolean;
  paletteRequested: boolean;
  inspectorRequested: boolean;
  compactPreference: CompactPanelPreference;
  proposalPending: boolean;
}): WorkspacePanelVisibility {
  const paletteWinsCompactOverlay =
    compact && paletteRequested && compactPreference === 'palette';
  const inspectorVisible = !paletteWinsCompactOverlay && inspectorRequested;
  return {
    inspectorVisible,
    paletteVisible: paletteRequested && (!compact || !inspectorVisible),
  };
}
