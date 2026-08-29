import { describe, expect, it } from 'vitest';

import { resolveWorkspacePanelVisibility } from './panel-visibility';

describe('resolveWorkspacePanelVisibility', () => {
  it('allows an explicitly closed desktop inspector to stay closed after selection opened it', () => {
    const selectionOpened = resolveWorkspacePanelVisibility({
      compact: false,
      paletteRequested: true,
      inspectorRequested: true,
      compactPreference: null,
      proposalPending: false,
    });
    const selectionPreservedAfterClose = resolveWorkspacePanelVisibility({
      compact: false,
      paletteRequested: true,
      inspectorRequested: false,
      compactPreference: null,
      proposalPending: false,
    });

    expect(selectionOpened).toEqual({ paletteVisible: true, inspectorVisible: true });
    expect(selectionPreservedAfterClose).toEqual({ paletteVisible: true, inspectorVisible: false });
  });

  it('keeps exactly one compact overlay visible for selection opening and palette reopening', () => {
    const selectionOpened = resolveWorkspacePanelVisibility({
      compact: true,
      paletteRequested: false,
      inspectorRequested: true,
      compactPreference: 'inspector',
      proposalPending: false,
    });
    const paletteReopened = resolveWorkspacePanelVisibility({
      compact: true,
      paletteRequested: true,
      inspectorRequested: false,
      compactPreference: 'palette',
      proposalPending: false,
    });

    expect(selectionOpened).toEqual({ paletteVisible: false, inspectorVisible: true });
    expect(paletteReopened).toEqual({ paletteVisible: true, inspectorVisible: false });
  });

  it('keeps a pending proposal in the inspector even when the compact palette was open', () => {
    expect(
      resolveWorkspacePanelVisibility({
        compact: true,
        paletteRequested: true,
        inspectorRequested: false,
        compactPreference: 'palette',
        proposalPending: true,
      }),
    ).toEqual({ paletteVisible: false, inspectorVisible: true });
  });

  it('allows an explicitly opened scenarios panel to close and reopen', () => {
    const scenarioOpened = resolveWorkspacePanelVisibility({
      compact: false,
      paletteRequested: true,
      inspectorRequested: true,
      compactPreference: null,
      proposalPending: false,
    });
    const scenarioClosed = resolveWorkspacePanelVisibility({
      compact: false,
      paletteRequested: true,
      inspectorRequested: false,
      compactPreference: null,
      proposalPending: false,
    });

    expect(scenarioOpened).toEqual({ paletteVisible: true, inspectorVisible: true });
    expect(scenarioClosed).toEqual({ paletteVisible: true, inspectorVisible: false });
  });
});
