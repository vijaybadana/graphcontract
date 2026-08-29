export type CompactPanelPreference = 'palette' | 'inspector' | null;

export type WorkspacePanelVisibility = {
  inspectorVisible: boolean;
  paletteVisible: boolean;
};

/**
 * Proposal and generated-scenario views are forced visibility states. Normal
 * canvas selection is intentionally absent: its user event opens the
 * inspector, allowing a later explicit collapse to remain collapsed.
 */
export function resolveWorkspacePanelVisibility({
  compact,
  paletteRequested,
  inspectorRequested,
  compactPreference,
  proposalPending,
  scenariosActive,
}: {
  compact: boolean;
  paletteRequested: boolean;
  inspectorRequested: boolean;
  compactPreference: CompactPanelPreference;
  proposalPending: boolean;
  scenariosActive: boolean;
}): WorkspacePanelVisibility {
  const forcedInspector = proposalPending || scenariosActive;
  const paletteWinsCompactOverlay =
    compact && paletteRequested && compactPreference === 'palette' && !forcedInspector;
  const inspectorVisible = !paletteWinsCompactOverlay && (inspectorRequested || forcedInspector);
  return {
    inspectorVisible,
    paletteVisible: paletteRequested && (!compact || !inspectorVisible),
  };
}
