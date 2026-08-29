// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GraphWorkspace } from './graph-workspace';
import { sampleGraph } from '@/src/domain';
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

  it('creates all five work presets as canonical Steps from the mounted palette', async () => {
    renderWorkspace(false);

    const expectedExecutors = {
      Step: 'deterministic',
      Agent: 'ai',
      Action: 'deterministic',
      Tool: 'tool',
      'Human review': 'human',
    } as const;
    for (const [label, executor] of Object.entries(expectedExecutors)) {
      const existingNodeIds = new Set(useGraphStore.getState().graph.nodes.map((node) => node.id));
      fireEvent.click(await screen.findByRole('button', { name: label }));
      const created = useGraphStore.getState().graph.nodes.find((node) => !existingNodeIds.has(node.id));
      expect(created).toMatchObject({ kind: 'step', executor });
    }
  }, 10_000);

  it('normalizes every work drag payload through the same canonical preset path as palette clicks', async () => {
    renderWorkspace(false);
    await screen.findByRole('button', { name: 'Agent' });
    const canvas = document.querySelector('.react-flow')!;
    const presets = [
      { label: 'Agent', payload: 'agent' },
      { label: 'Action', payload: 'action' },
      { label: 'Tool', payload: 'tool' },
      { label: 'Human review', payload: 'human_input' },
    ] as const;
    const stepSemantics = (node: ReturnType<typeof useGraphStore.getState>['graph']['nodes'][number]) => {
      if (node.kind !== 'step') throw new Error('Expected every work palette payload to create a Step.');
      return {
        kind: node.kind,
        executor: node.executor,
        participation: node.participation ?? null,
        hitl: node.hitl ?? null,
        modifiers: node.modifiers ?? null,
      };
    };

    for (const preset of presets) {
      const beforeClick = new Set(useGraphStore.getState().graph.nodes.map((node) => node.id));
      fireEvent.click(await screen.findByRole('button', { name: preset.label }));
      const clicked = useGraphStore.getState().graph.nodes.find((node) => !beforeClick.has(node.id));
      if (!clicked) throw new Error(`Expected click creation for ${preset.label}.`);

      const beforeDrop = new Set(useGraphStore.getState().graph.nodes.map((node) => node.id));
      fireEvent.drop(canvas, {
        clientX: 640,
        clientY: 360,
        dataTransfer: { getData: () => preset.payload },
      });
      const dropped = useGraphStore.getState().graph.nodes.find((node) => !beforeDrop.has(node.id));
      if (!dropped) throw new Error(`Expected drag creation for ${preset.payload}.`);

      expect(stepSemantics(dropped)).toEqual(stepSemantics(clicked));
    }
  }, 10_000);

  it('uses visible chips and keyboard overflow to select a Step and focus stable inspector sections', async () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected a canonical Step fixture.');
    classifier.participation = { internalTools: true };
    classifier.hitl = { enabled: true, timing: 'before', inputType: 'approval' };
    classifier.modifiers = {
      guardrail: true,
      sensitiveSideEffect: true,
      storeRead: true,
      storeWrite: true,
      retryFallback: true,
      opaque: true,
      readiness: 'degraded',
    };
    useGraphStore.setState({ graph });
    renderWorkspace(false);

    const classifierShell = (await screen.findByText('Classifier Agent')).closest('.react-flow__node')!;
    const executorChip = classifierShell.querySelector<HTMLButtonElement>('[data-modifier-id="executor"]')!;
    fireEvent.click(executorChip);
    await waitFor(() => {
      expect(useGraphStore.getState().selection.primary).toEqual({ type: 'node', id: 'classifier' });
      expect(document.activeElement).toBe(document.querySelector('#inspector-step-executor'));
    });

    const overflow = classifierShell.querySelector<HTMLButtonElement>('.contract-node-modifier-overflow-button')!;
    overflow.focus();
    fireEvent.keyDown(overflow, { key: 'Enter' });
    const guardrail = await screen.findByRole('button', { name: /Guardrail\. Focus modifiers/i });
    await waitFor(() => expect(document.activeElement).toBe(guardrail));
    fireEvent.click(guardrail);
    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('#inspector-step-modifiers'));
    });
  }, 10_000);

  it('disables Reset during any proposal review without replacing the accepted graph, then restores it after reject or approval', async () => {
    const before = structuredClone(useGraphStore.getState().graph);
    const pending = useGraphStore.getState().submitProposal({
      rationale: 'Rename the classifier for review.',
      operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label: 'Classifier review' } }],
    });
    expect(pending.ok).toBe(true);
    renderWorkspace(false);

    const reset = await screen.findByRole('button', { name: 'Reset example graph' });
    expect(reset.disabled).toBe(true);
    fireEvent.click(reset);
    expect(useGraphStore.getState().graph).toEqual(before);
    expect(useGraphStore.getState().proposal).toMatchObject({ status: 'pending' });

    useGraphStore.getState().rejectProposal();
    await waitFor(() => expect(reset.disabled).toBe(false));
    expect(useGraphStore.getState().graph).toEqual(before);

    const approved = useGraphStore.getState().submitProposal({
      rationale: 'Rename the classifier after review.',
      operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label: 'Approved classifier' } }],
    });
    expect(approved.ok).toBe(true);
    await waitFor(() => expect(reset.disabled).toBe(true));
    expect(useGraphStore.getState().approveProposal().ok).toBe(true);
    await waitFor(() => expect(reset.disabled).toBe(false));
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier')?.label).toBe('Approved classifier');
  }, 10_000);
});
