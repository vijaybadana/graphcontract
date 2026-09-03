// @vitest-environment jsdom

import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceHeader } from './workspace-header';

const callbacks = {
  onTogglePalette() {},
  onToggleInspector() {},
  onOpenLibrary() {},
  onUndo() {},
  onRedo() {},
  onDuplicate() {},
  onDelete() {},
  onAutoLayout() {},
  onFit() {},
  onReset() {},
  onFreeze() {},
  onUnfreeze() {},
  onViewModeChange() {},
};

afterEach(() => cleanup());

describe('WorkspaceHeader freeze control', () => {
  it('offers all presentation themes and reports selector changes', () => {
    const onThemeChange = vi.fn();
    render(
      <WorkspaceHeader
        graphName="Support workflow"
        graphStatus="draft"
        webMcpStatus="connected"
        nodeCount={7}
        edgeCount={6}
        issueCount={0}
        proposalPending={false}
        libraryOpen={false}
        libraryEntryCount={10}
        paletteOpen
        inspectorOpen={false}
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze
        canAutoLayout
        scenarioCount={0}
        viewMode="design"
        runtimeAvailable={false}
        theme="dark"
        {...callbacks}
        onThemeChange={onThemeChange}
      />,
    );

    const selector = screen.getByRole('button', { name: 'Workspace theme: Dark' });
    expect(selector.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(selector);
    expect(selector.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Workspace theme' });
    expect(within(menu).getAllByRole('menuitemradio').map((option) => option.textContent)).toEqual(['Classic', 'Dark', 'Signal']);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Signal' }));
    expect(onThemeChange).toHaveBeenCalledWith('signal');
    expect(screen.queryByRole('menu', { name: 'Workspace theme' })).toBeNull();
  });

  it('exposes the ten-entry Graph Library as a top-level dialog control', () => {
    const onOpenLibrary = vi.fn();
    render(
      <WorkspaceHeader
        graphName="Support workflow"
        graphStatus="draft"
        webMcpStatus="connected"
        nodeCount={7}
        edgeCount={6}
        issueCount={0}
        proposalPending={false}
        libraryOpen={false}
        libraryEntryCount={10}
        paletteOpen
        inspectorOpen={false}
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze
        canAutoLayout
        scenarioCount={0}
        viewMode="design"
        runtimeAvailable={false}
        {...callbacks}
        onOpenLibrary={onOpenLibrary}
      />,
    );

    const button = screen.getByRole('button', { name: 'Workflow library, 10 templates' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('data-tooltip')).toBe('Browse workflow library');
    fireEvent.click(button);
    expect(onOpenLibrary).toHaveBeenCalledOnce();
  });

  it('exposes all four presentation modes with truthful unavailable states', () => {
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
        libraryOpen={false}
        libraryEntryCount={10}
        paletteOpen
        inspectorOpen
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze
        canAutoLayout
        scenarioCount={0}
        viewMode="design"
        runtimeAvailable={false}
        runtimeUnavailableReason="No runtime trace or fixture is available."
        {...callbacks}
        onViewModeChange={onViewModeChange}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Design' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('radio', { name: /Scenario unavailable:/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: /Proposal unavailable:/ }) as HTMLButtonElement).disabled).toBe(true);
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
        libraryOpen={false}
        libraryEntryCount={10}
        paletteOpen
        inspectorOpen
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze
        canAutoLayout
        scenarioCount={0}
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

    cleanup();
    render(
      <WorkspaceHeader
        graphName="Frozen support"
        graphStatus="frozen"
        webMcpStatus="connected"
        nodeCount={7}
        edgeCount={6}
        issueCount={0}
        proposalPending={false}
        libraryOpen={false}
        libraryEntryCount={10}
        paletteOpen
        inspectorOpen
        canUndo={false}
        canRedo={false}
        canDuplicate={false}
        canDelete={false}
        canFreeze={false}
        canAutoLayout={false}
        scenarioCount={3}
        viewMode="scenario"
        runtimeAvailable={false}
        {...callbacks}
        onViewModeChange={onViewModeChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Scenario' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('radio', { name: 'Scenario' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('uses roving radio focus and skips unavailable modes with every navigation key', () => {
    function PresentationHarness() {
      const [viewMode, setViewMode] = useState<'design' | 'scenario' | 'proposal' | 'runtime'>('design');
      return (
        <WorkspaceHeader
          graphName="Parallel research"
          graphStatus="frozen"
          webMcpStatus="connected"
          nodeCount={6}
          edgeCount={5}
          issueCount={0}
          proposalPending={false}
          libraryOpen={false}
          libraryEntryCount={10}
          paletteOpen
          inspectorOpen
          canUndo={false}
          canRedo={false}
          canDuplicate={false}
          canDelete={false}
          canFreeze={false}
          canAutoLayout={false}
          scenarioCount={4}
          viewMode={viewMode}
          runtimeAvailable
          {...callbacks}
          onViewModeChange={setViewMode}
        />
      );
    }

    render(<PresentationHarness />);

    const design = screen.getByRole('radio', { name: 'Design' });
    const scenario = screen.getByRole('radio', { name: 'Scenario' });
    const proposal = screen.getByRole('radio', { name: /Proposal unavailable:/ });
    const runtime = screen.getByRole('radio', { name: 'Runtime' });

    expect(design.tabIndex).toBe(0);
    expect(scenario.tabIndex).toBe(-1);
    expect(proposal.tabIndex).toBe(-1);
    expect(runtime.tabIndex).toBe(-1);

    design.focus();
    fireEvent.keyDown(design, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(scenario);
    expect(scenario.getAttribute('aria-checked')).toBe('true');
    expect(scenario.tabIndex).toBe(0);

    fireEvent.keyDown(scenario, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(runtime);
    expect(runtime.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(runtime, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(design);
    expect(design.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(design, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(runtime);

    fireEvent.keyDown(runtime, { key: 'Home' });
    expect(document.activeElement).toBe(design);

    fireEvent.keyDown(design, { key: 'End' });
    expect(document.activeElement).toBe(runtime);

    fireEvent.keyDown(runtime, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(scenario);
  });

  it('keeps compact-safe status-aware names while preserving desktop labels', () => {
    const baseProps = {
      graphName: 'Research Intake',
      webMcpStatus: 'connected' as const,
      nodeCount: 8,
      edgeCount: 8,
      issueCount: 0,
      proposalPending: false,
      libraryOpen: false,
      libraryEntryCount: 10,
      paletteOpen: true,
      inspectorOpen: true,
      canUndo: false,
      canRedo: false,
      canDuplicate: false,
      canDelete: false,
      canFreeze: true,
      canAutoLayout: true,
      scenarioCount: 0,
      viewMode: 'design' as const,
      runtimeAvailable: false,
      runtimeUnavailableReason: 'No runtime trace or fixture is available.',
      ...callbacks,
    };

    render(<WorkspaceHeader {...baseProps} graphStatus="draft" />);
    expect(screen.getByText('GraphContract')).toBeTruthy();
    const githubLink = screen.getByRole('link', { name: /Open GraphContract on GitHub/ });
    expect(githubLink.getAttribute('href')).toBe(
      'https://github.com/vijaybadana/graphcontract',
    );
    expect(githubLink.querySelector('.github-brand-mark__black')).not.toBeNull();
    expect(githubLink.querySelector('.github-brand-mark__white')).not.toBeNull();
    expect(screen.queryByText('Human-approved workflows')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirm and freeze contract; currently draft' })).toBeTruthy();
    expect(screen.getByText('Confirm & freeze')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Design' })).toBeTruthy();
    expect(screen.getByText('Cases').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Review').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Run').getAttribute('aria-hidden')).toBe('true');
    const library = screen.getByRole('button', { name: 'Workflow library, 10 templates' });
    expect(library.querySelector('.workspace-library-label')?.textContent).toBe('Library');
    expect(library.querySelector('.workspace-library-count')?.textContent).toBe('10');

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
      libraryOpen: false,
      libraryEntryCount: 10,
      paletteOpen: true,
      inspectorOpen: true,
      canUndo: false,
      canRedo: false,
      canDuplicate: false,
      canDelete: false,
      canFreeze: false,
      canAutoLayout: false,
      scenarioCount: 0,
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

  it('exposes an explicit Auto-layout action and keeps it inert while editing is locked', () => {
    const onAutoLayout = vi.fn();
    const props = {
      graphName: 'Support workflow',
      graphStatus: 'draft' as const,
      webMcpStatus: 'connected' as const,
      nodeCount: 7,
      edgeCount: 6,
      issueCount: 0,
      proposalPending: false,
      libraryOpen: false,
      libraryEntryCount: 10,
      paletteOpen: true,
      inspectorOpen: false,
      canUndo: false,
      canRedo: false,
      canDuplicate: false,
      canDelete: false,
      canFreeze: true,
      canAutoLayout: true,
      scenarioCount: 0,
      viewMode: 'design' as const,
      runtimeAvailable: false,
      ...callbacks,
      onAutoLayout,
    };

    render(<WorkspaceHeader {...props} />);
    const autoLayout = screen.getByRole('button', { name: 'Auto-layout graph' });
    expect(autoLayout.getAttribute('data-tooltip')).toBe('Auto-layout graph');
    expect(autoLayout.hasAttribute('title')).toBe(false);
    fireEvent.click(autoLayout);
    expect(onAutoLayout).toHaveBeenCalledOnce();

    cleanup();
    render(<WorkspaceHeader {...props} graphStatus="frozen" canAutoLayout={false} />);
    expect((screen.getByRole('button', { name: 'Auto-layout graph' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps history and selection mutations together in the middle command island with prompt tooltips', () => {
    const { container } = render(
      <WorkspaceHeader
        graphName="Support workflow"
        graphStatus="draft"
        webMcpStatus="connected"
        nodeCount={7}
        edgeCount={6}
        issueCount={0}
        proposalPending={false}
        libraryOpen={false}
        libraryEntryCount={14}
        paletteOpen
        inspectorOpen={false}
        canUndo
        canRedo
        canDuplicate
        canDelete
        canFreeze
        canAutoLayout
        scenarioCount={0}
        viewMode="design"
        runtimeAvailable={false}
        {...callbacks}
      />,
    );

    const group = screen.getByRole('group', { name: 'History and edit controls' });
    expect(within(group).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Undo',
      'Redo',
      'Duplicate selection',
      'Delete selection',
    ]);
    expect(container.querySelector('.workspace-brand-island .workspace-icon-button')).toBeNull();
    for (const label of ['Undo', 'Redo', 'Duplicate selection', 'Delete selection', 'Fit graph', 'Reset example graph']) {
      const button = screen.getByRole('button', { name: label });
      expect(button.getAttribute('data-tooltip')).toBe(label);
      expect(button.hasAttribute('title')).toBe(false);
    }
  });
});
