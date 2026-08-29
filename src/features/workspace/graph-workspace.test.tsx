// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GraphWorkspace } from './graph-workspace';
import { useGraphStore } from '@/src/state/workspace-store';

type MatchMediaStub = (query: string) => MediaQueryList;

function setCompactWorkspace(compact: boolean) {
  const matchMedia: MatchMediaStub = () => ({
    matches: compact,
    media: '(max-width: 1099px)',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });
}

function renderWorkspace(compact: boolean) {
  setCompactWorkspace(compact);
  render(
    <ReactFlowProvider>
      <GraphWorkspace />
    </ReactFlowProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useGraphStore.getState().resetGraph();
  useGraphStore.setState({
    selection: { nodeIds: [], subgraphIds: [], edgeIds: [], primary: null },
    clipboardNodeIds: [],
    past: [],
    future: [],
    notice: null,
    fitViewRevision: 0,
  });
});

afterEach(() => cleanup());

describe('GraphWorkspace subgraph creation', () => {
  it('opens Edit & review while keeping the desktop palette open after palette click creation', async () => {
    renderWorkspace(false);

    const subgraph = await screen.findByRole('button', { name: 'Subgraph' });
    fireEvent.click(subgraph);

    expect((await screen.findByRole('tab', { name: 'Edit & review' })).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Collapse node palette' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse inspector' }));
    expect(screen.getByRole('button', { name: 'Open Inspector' })).toBeTruthy();
  }, 10_000);

  it('opens Edit & review and replaces the compact palette after palette drop creation', async () => {
    renderWorkspace(true);

    await screen.findByRole('button', { name: 'Subgraph' });
    const canvas = document.querySelector('.react-flow')!;
    fireEvent.drop(canvas, {
      clientX: 640,
      clientY: 360,
      dataTransfer: { getData: () => 'subgraph' },
    });

    expect((await screen.findByRole('tab', { name: 'Edit & review' })).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Collapse node palette' })).toBeNull();
    });
  }, 10_000);
});
