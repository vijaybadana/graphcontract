// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceHeader } from './workspace-header';

const callbacks = {
  onTogglePalette() {},
  onToggleInspector() {},
  onUndo() {},
  onRedo() {},
  onDuplicate() {},
  onDelete() {},
  onFit() {},
  onReset() {},
  onFreeze() {},
  onUnfreeze() {},
};

afterEach(() => cleanup());

describe('WorkspaceHeader freeze control', () => {
  it('keeps compact-safe status-aware names while preserving desktop labels', () => {
    const baseProps = {
      graphName: 'Research Intake',
      webMcpStatus: 'connected' as const,
      nodeCount: 8,
      edgeCount: 8,
      issueCount: 0,
      proposalPending: false,
      paletteOpen: true,
      inspectorOpen: true,
      canUndo: false,
      canRedo: false,
      canDuplicate: false,
      canDelete: false,
      canFreeze: true,
      ...callbacks,
    };

    render(<WorkspaceHeader {...baseProps} graphStatus="draft" />);
    expect(screen.getByRole('button', { name: 'Confirm and freeze contract; currently draft' })).toBeTruthy();
    expect(screen.getByText('Confirm & freeze')).toBeTruthy();

    cleanup();
    render(<WorkspaceHeader {...baseProps} graphStatus="frozen" />);
    expect(screen.getByRole('button', { name: 'Unfreeze contract; currently frozen' })).toBeTruthy();
    expect(screen.getByText('Unfreeze')).toBeTruthy();
  });

  it('locks Reset example graph for every proposal review state', () => {
    const baseProps = {
      graphName: 'Research Intake',
      graphStatus: 'draft' as const,
      webMcpStatus: 'connected' as const,
      nodeCount: 8,
      edgeCount: 8,
      issueCount: 0,
      paletteOpen: true,
      inspectorOpen: true,
      canUndo: false,
      canRedo: false,
      canDuplicate: false,
      canDelete: false,
      canFreeze: false,
      ...callbacks,
    };

    render(<WorkspaceHeader {...baseProps} proposalPending />);
    expect(screen.getByRole('button', { name: 'Reset example graph' }).disabled).toBe(true);

    cleanup();
    render(<WorkspaceHeader {...baseProps} proposalPending={false} />);
    expect(screen.getByRole('button', { name: 'Reset example graph' }).disabled).toBe(false);
  });
});
