// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  onViewModeChange() {},
};

afterEach(() => cleanup());

describe('WorkspaceHeader freeze control', () => {
  it('exposes Design and Runtime as an accessible projection switch with a truthful unavailable state', () => {
    const onViewModeChange = vi.fn();
    render(
      <WorkspaceHeader
        graphName="Parallel research"
        graphStatus="draft"
        webMcpStatus="connected"
        nodeCount={6}
        edgeCount={5}
        issueCount={0}
        proposalPending={false}
        paletteOpen
        inspectorOpen
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze
        viewMode="design"
        runtimeAvailable={false}
        runtimeUnavailableReason="No runtime trace or fixture is available."
        {...callbacks}
        onViewModeChange={onViewModeChange}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Design' }).getAttribute('aria-checked')).toBe('true');
    const runtime = screen.getByRole('radio', { name: /Runtime unavailable:/ });
    expect((runtime as HTMLButtonElement).disabled).toBe(true);
    expect(runtime.getAttribute('title')).toBe('No runtime trace or fixture is available.');

    cleanup();
    render(
      <WorkspaceHeader
        graphName="Parallel research"
        graphStatus="draft"
        webMcpStatus="connected"
        nodeCount={6}
        edgeCount={5}
        issueCount={0}
        proposalPending={false}
        paletteOpen
        inspectorOpen
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze
        viewMode="runtime"
        runtimeAvailable
        {...callbacks}
        onViewModeChange={onViewModeChange}
      />,
    );
    const design = screen.getByRole('radio', { name: 'Design' });
    expect(screen.getByRole('radio', { name: 'Runtime' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(design);
    expect(onViewModeChange).toHaveBeenCalledWith('design');
  });

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
      viewMode: 'design' as const,
      runtimeAvailable: false,
      runtimeUnavailableReason: 'No runtime trace or fixture is available.',
      ...callbacks,
    };

    render(<WorkspaceHeader {...baseProps} graphStatus="draft" />);
    expect(screen.getByRole('button', { name: 'Confirm and freeze contract; currently draft' })).toBeTruthy();
    expect(screen.getByText('Confirm & freeze')).toBeTruthy();

    cleanup();
    render(<WorkspaceHeader {...baseProps} graphStatus="frozen" />);
    expect(screen.getByRole('button', { name: 'Unfreeze contract; currently frozen' })).toBeTruthy();
    expect(screen.getByText('Unfreeze')).toBeTruthy();
  }, 15_000);

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
      viewMode: 'design' as const,
      runtimeAvailable: false,
      runtimeUnavailableReason: 'No runtime trace or fixture is available.',
      ...callbacks,
    };

    render(<WorkspaceHeader {...baseProps} proposalPending />);
    expect(screen.getByRole('button', { name: 'Reset example graph' }).disabled).toBe(true);

    cleanup();
    render(<WorkspaceHeader {...baseProps} proposalPending={false} />);
    expect(screen.getByRole('button', { name: 'Reset example graph' }).disabled).toBe(false);
  });
});
