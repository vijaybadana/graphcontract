export type CompactPanelPreference = 'palette' | 'inspector' | null;

export type WorkspacePanelVisibility = {
  inspectorVisible: boolean;
  paletteVisible: boolean;
};

/**
 * A pending proposal is the only forced visibility state. Normal canvas
 * selection and generated scenarios open the inspector from their user
 * handlers, allowing a later explicit collapse to remain collapsed.
 */
export function resolveWorkspacePanelVisibility({
  compact,
  paletteRequested,
  inspectorRequested,
  compactPreference,
  proposalPending,
}: {
  compact: boolean;
  paletteRequested: boolean;
  inspectorRequested: boolean;
  compactPreference: CompactPanelPreference;
  proposalPending: boolean;
}): WorkspacePanelVisibility {
  const forcedInspector = proposalPending;
  const paletteWinsCompactOverlay =
    compact && paletteRequested && compactPreference === 'palette' && !forcedInspector;
  const inspectorVisible = !paletteWinsCompactOverlay && (inspectorRequested || forcedInspector);
  return {
    inspectorVisible,
    paletteVisible: paletteRequested && (!compact || !inspectorVisible),
  };
}
