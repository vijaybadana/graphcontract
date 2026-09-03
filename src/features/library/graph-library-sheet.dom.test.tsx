// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GraphLibraryEntry } from '@/src/application/graph-library-contract';
import { createDefaultGraphCapabilities } from '@/src/domain';

import { GraphLibrarySheet } from './graph-library-sheet';

const entries: readonly GraphLibraryEntry[] = [
  {
    id: 'research',
    title: 'Hierarchical Deep Research',
    outcome: 'Routes evidence collection through specialist review.',
    domain: 'Research',
    complexity: 'advanced',
    concepts: ['Routing', 'HITL'],
    source: { owner: 'langchain-ai', repository: 'open_deep_research', url: 'https://github.com/langchain-ai/open_deep_research', note: 'Runtime worker pools are intentionally deferred.' },
    graph: {
      id: 'research-graph', name: 'Research graph', schemaVersion: '6', status: 'draft', updatedAt: '2026-08-30T00:00:00.000Z', capabilities: createDefaultGraphCapabilities(), subgraphs: [], relationships: [],
      nodes: [
        { id: 'start', kind: 'start', label: 'Begin', position: { x: 0, y: 20 } },
        { id: 'review', kind: 'step', label: 'Review', position: { x: 180, y: 20 }, executor: 'deterministic' },
        { id: 'end', kind: 'end', label: 'Complete', position: { x: 360, y: 20 } },
      ],
      edges: [
        { id: 'start-review', source: 'start', target: 'review', mode: 'normal' },
        { id: 'review-end', source: 'review', target: 'end', mode: 'normal' },
      ],
    },
    scenarioSummary: { pathCount: 1, scenarios: [] },
  },
  {
    id: 'incident',
    title: 'Human-Approved Incident Response',
    outcome: 'Coordinates an operational response after approval.',
    domain: 'Operations',
    complexity: 'intermediate',
    concepts: ['HITL', 'Merge'],
    source: { owner: 'AttiR', repository: 'OpsCanvas', url: 'https://github.com/AttiR/OpsCanvas' },
    graph: {
      id: 'incident-graph', name: 'Incident graph', schemaVersion: '6', status: 'draft', updatedAt: '2026-08-30T00:00:00.000Z', capabilities: createDefaultGraphCapabilities(), subgraphs: [], relationships: [],
      nodes: [
        { id: 'start', kind: 'start', label: 'Begin', position: { x: 0, y: 0 } },
        { id: 'merge', kind: 'merge', label: 'Coordinate', position: { x: 180, y: 40 }, merge: { reducer: { name: 'all', aggregateState: 'updates' }, completion: { mode: 'all' }, continuation: { mode: 'once' }, waitingForDynamicInputs: true } },
        { id: 'end', kind: 'end', label: 'Complete', position: { x: 360, y: 80 } },
      ],
      edges: [
        { id: 'start-merge', source: 'start', target: 'merge', mode: 'normal' },
        { id: 'merge-end', source: 'merge', target: 'end', mode: 'send', send: { destinationTemplateId: 'end', multiplicity: 'dynamic', payloadLabel: 'incident', mergeNodeId: 'merge' } },
      ],
    },
    scenarioSummary: { pathCount: 1, scenarios: [] },
  },
];

afterEach(() => cleanup());

describe('GraphLibrarySheet', () => {
  it('searches and filters entries, including a useful empty state', () => {
    render(<GraphLibrarySheet open entries={entries} onClose={() => {}} onRequestOpen={() => {}} />);

    expect(screen.getByText('Showing 2 of 2 templates').classList.contains('sr-only')).toBe(true);
    expect(screen.queryByText('Workflow templates')).toBeNull();
    expect(screen.queryByText('Graph library')).toBeNull();
    expect(screen.queryByText('Open graph')).toBeNull();
    expect(screen.queryByText('Runtime worker pools are intentionally deferred.')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search graph library' }), { target: { value: 'incident' } });
    expect(screen.getByText('Showing 1 of 2 templates')).toBeTruthy();
    expect(screen.getByText('Human-Approved Incident Response')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Research' }));
    expect(screen.getByRole('heading', { name: 'No matching templates' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(screen.getByText('Showing 2 of 2 templates')).toBeTruthy();
  });

  it('keeps the GitHub source link isolated from graph loading', () => {
    const onRequestOpen = vi.fn();
    render(<GraphLibrarySheet open entries={entries} onClose={() => {}} onRequestOpen={onRequestOpen} />);

    const sourceLink = screen.getByRole('link', { name: 'Open langchain-ai/open_deep_research on GitHub' });
    expect(sourceLink.getAttribute('href')).toBe('https://github.com/langchain-ai/open_deep_research');
    expect(sourceLink.getAttribute('target')).toBe('_blank');
    expect(sourceLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(sourceLink.textContent).toContain('GitHub');
    const githubMark = sourceLink.querySelector('.graph-library-card__github-mark');
    expect(githubMark).not.toBeNull();
    expect(githubMark?.querySelector('.github-brand-mark__black')?.getAttribute('src')).toBe(
      '/brand/github/GitHub_Invertocat_Black.svg',
    );
    expect(githubMark?.querySelector('.github-brand-mark__white')?.getAttribute('src')).toBe(
      '/brand/github/GitHub_Invertocat_White.svg',
    );
    fireEvent.click(sourceLink);
    expect(onRequestOpen).not.toHaveBeenCalled();
  });

  it('confirms replacement inside the library and restores focus after cancellation', async () => {
    const onRequestOpen = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open library</button>
          <GraphLibrarySheet open={open} entries={entries} currentLoadedId="research" onClose={() => setOpen(false)} onRequestOpen={onRequestOpen} />
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open library' });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search graph library' })).toBe(document.activeElement));
    expect(screen.getByText('Loaded')).toBeTruthy();
    const openEntry = screen.getByRole('button', { name: 'Open Hierarchical Deep Research' });
    fireEvent.click(openEntry);
    const confirmation = screen.getByRole('alertdialog', { name: 'Open “Hierarchical Deep Research”?' });
    expect(confirmation).toBeTruthy();
    expect(confirmation.closest('.graph-library-sheet__panel')).toBeNull();
    expect(confirmation.closest('.graph-library-confirmation')?.parentElement?.classList.contains('graph-library-sheet')).toBe(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBe(document.activeElement));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(openEntry));
    expect(onRequestOpen).not.toHaveBeenCalled();

    fireEvent.click(openEntry);
    fireEvent.click(screen.getByRole('button', { name: 'Replace canvas' }));
    expect(onRequestOpen).toHaveBeenCalledWith(entries[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Close graph library' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    cleanup();
    render(
      <GraphLibrarySheet
        open
        entries={entries}
        replacementBlockedReason="Library replacement is blocked while a proposal awaits review."
        onClose={() => {}}
        onRequestOpen={onRequestOpen}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('proposal awaits review');
    const blockedAction = screen.getByRole('button', { name: /Open Hierarchical Deep Research unavailable/ }) as HTMLButtonElement;
    expect(blockedAction.disabled).toBe(true);
    fireEvent.click(blockedAction);
    expect(onRequestOpen).toHaveBeenCalledTimes(1);
  });

  it('supports Escape cancellation and direct opening when the canvas is empty', async () => {
    const onRequestOpen = vi.fn();
    const { rerender } = render(<GraphLibrarySheet open entries={entries} onClose={() => {}} onRequestOpen={onRequestOpen} />);
    const openEntry = screen.getByRole('button', { name: 'Open Hierarchical Deep Research' });
    fireEvent.click(openEntry);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(openEntry));
    expect(onRequestOpen).not.toHaveBeenCalled();

    rerender(
      <GraphLibrarySheet
        open
        entries={entries}
        confirmationRequired={false}
        onClose={() => {}}
        onRequestOpen={onRequestOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Hierarchical Deep Research' }));
    expect(onRequestOpen).toHaveBeenCalledWith(entries[0]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
