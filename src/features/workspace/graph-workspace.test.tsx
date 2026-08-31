// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GraphWorkspace, reconcileProjectionSelection } from './graph-workspace';
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
  if (useGraphStore.getState().graph.status === 'frozen') useGraphStore.getState().unfreezeGraph();
  if (useGraphStore.getState().proposal) useGraphStore.getState().rejectProposal();
  useGraphStore.getState().resetGraph();
  useGraphStore.setState({
    selection: { nodeIds: [], subgraphIds: [], edgeIds: [], primary: null },
    clipboardNodeIds: [],
    past: [],
    future: [],
    notice: null,
    fitViewRevision: 0,
    runtimeProjectionFixture: null,
  });
});

afterEach(() => cleanup());

describe('GraphWorkspace subgraph creation', () => {
  it('opens and refocuses the requested graph capability settings from the strip', async () => {
    renderWorkspace(false);

    const storeCapability = await screen.findByRole('button', { name: /Store: Off, Cross-thread knowledge/i });
    fireEvent.click(storeCapability);
    const storeTab = await screen.findByRole('tab', { name: 'Store' });
    expect(storeTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(storeTab);

    fireEvent.click(screen.getByRole('tab', { name: 'State' }));
    expect(screen.getByRole('tab', { name: 'State' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(storeCapability);

    await waitFor(() => {
      const requestedStoreTab = screen.getByRole('tab', { name: 'Store' });
      expect(requestedStoreTab.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(requestedStoreTab);
    });
  }, 30_000);

  it('shows validated observed workers only in Runtime view without mutating the accepted graph', async () => {
    useGraphStore.getState().loadDynamicParallelismDemo();
    const acceptedBefore = structuredClone(useGraphStore.getState().graph);
    renderWorkspace(false);

    const runtime = await screen.findByRole('radio', { name: 'Runtime' });
    expect((runtime as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(runtime);

    expect(await screen.findByText(/Runtime projection · observed instances are read-only/)).toBeTruthy();
    const instance = await screen.findByText('Search evidence · query 1');
    fireEvent.click(instance);
    expect(await screen.findByText(/Observed trace projection — read-only/)).toBeTruthy();
    expect(useGraphStore.getState().graph).toEqual(acceptedBefore);
  }, 30_000);

  it('opens Edit & review while keeping the desktop palette open after palette click creation', async () => {
    renderWorkspace(false);

    const subgraph = await screen.findByRole('button', { name: 'Subgraph' });
    fireEvent.click(subgraph);

    expect((await screen.findByRole('tab', { name: 'Edit & review' })).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Collapse node palette' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse inspector' }));
    expect(screen.getByRole('button', { name: 'Open Inspector' })).toBeTruthy();
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

  it('uses visible chips and keyboard overflow to select a Step and focus stable inspector sections', async () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected a canonical Step fixture.');
    classifier.participation = { internalTools: true };
    classifier.hitl = {
      enabled: true,
      timing: 'before',
      response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'billing' }] },
    };
    classifier.sensitive = {
      target: 'Customer billing record',
      authorization: 'Billing administrator',
      approvalRequired: true,
      idempotency: 'Ticket ID',
    };
    classifier.modifiers = {
      guardrail: true,
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

  it('keeps scenario selection as a projection and clears highlighting when returning to Design', async () => {
    renderWorkspace(false);

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm and freeze contract; currently draft' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Scenario' }).getAttribute('aria-checked')).toBe('true');
    });

    const scenarioButton = document.querySelector<HTMLButtonElement>('[data-scenario-id]');
    expect(scenarioButton).toBeTruthy();
    fireEvent.click(scenarioButton!);
    await waitFor(() => {
      expect(document.querySelector('.scenario-state--active')).toBeTruthy();
      expect(document.querySelector('.scenario-state--dimmed')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Design' }));
    await waitFor(() => {
      expect(document.querySelector('.scenario-state--active')).toBeNull();
      expect(document.querySelector('.scenario-state--dimmed')).toBeNull();
    });
    expect(useGraphStore.getState().graph.status).toBe('frozen');

    fireEvent.click(screen.getByRole('button', { name: 'Unfreeze contract; currently frozen' }));
    await waitFor(() => {
      expect(useGraphStore.getState().graph.status).toBe('draft');
      expect(screen.getByRole('radio', { name: 'Design' }).getAttribute('aria-checked')).toBe('true');
    });
  }, 30_000);

  it('automatically opens a read-only Proposal presentation without mutating the accepted graph', async () => {
    const accepted = structuredClone(useGraphStore.getState().graph);
    expect(useGraphStore.getState().submitProposal({
      rationale: 'Review a stable-ID comparison.',
      operations: [
        { type: 'update_node', nodeId: 'classifier', patch: { label: 'Proposed classifier' } },
        {
          type: 'update_graph_capabilities',
          patch: { store: { available: true, namespace: 'proposal-memory' } },
        },
      ],
    }).ok).toBe(true);

    renderWorkspace(false);
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Proposal' }).getAttribute('aria-checked')).toBe('true');
    });
    expect(await screen.findByRole('heading', { name: 'Before / Proposed' })).toBeTruthy();
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('Proposed')).toBeTruthy();
    expect(screen.getByRole('button', {
      name: /Store: Available, Direct Step R\/W available/i,
    })).toBeTruthy();
    expect(useGraphStore.getState().graph).toEqual(accepted);

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => {
      expect(useGraphStore.getState().proposal).toBeNull();
      expect(screen.getByRole('radio', { name: 'Design' }).getAttribute('aria-checked')).toBe('true');
    });
    expect(useGraphStore.getState().graph).toEqual(accepted);
  }, 30_000);

  it('clears stale local evidence and relationship selections after replacement, reset, load, or approval', () => {
    const selectedEvidence = {
      number: 4,
      target: 'relationship' as const,
      id: 'notify-runner',
      label: 'Notify runner',
      provenance: { representation: 'external-orchestration' as const },
      nativeControlEdge: false,
    };

    expect(reconcileProjectionSelection(
      selectedEvidence,
      'notify-runner',
      [],
      [],
    )).toEqual({ evidence: null, relationshipId: null });
    expect(reconcileProjectionSelection(
      selectedEvidence,
      'notify-runner',
      [selectedEvidence],
      [{ id: 'notify-runner' }],
    )).toEqual({ evidence: selectedEvidence, relationshipId: 'notify-runner' });
  });
});
