// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('presents one labelled graph overview with normalized semantic node marks', async () => {
    renderWorkspace(false);

    const overview = await screen.findByRole('img', {
      name: 'Graph overview navigator. Drag or click to pan; scroll to zoom.',
    });
    expect(screen.queryByText('Graph overview')).toBeNull();
    expect(overview.querySelectorAll('.react-flow__minimap-mask')).toHaveLength(1);
    expect(document.querySelectorAll('.graph-overview-viewport')).toHaveLength(1);
    expect(overview.closest('.canvas-minimap')?.getAttribute('style')).toContain(
      '--xy-minimap-mask-stroke-color-props: transparent',
    );

    await waitFor(() => {
      const marks = overview.querySelectorAll<SVGRectElement>('.graph-overview-node');
      expect(marks.length).toBe(useGraphStore.getState().graph.nodes.length);
      for (const mark of marks) {
        expect(Number(mark.getAttribute('width'))).toBeLessThanOrEqual(180);
        expect(Number(mark.getAttribute('height'))).toBeLessThanOrEqual(90);
      }
    });
  }, 30_000);

  it('opens graph capability settings from the contextual inspector', async () => {
    renderWorkspace(false);

    fireEvent.click(await screen.findByRole('button', { name: 'Show inspector' }));
    expect((await screen.findByRole('tab', { name: 'State' })).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Store' }));
    expect(screen.getByRole('tab', { name: 'Store' }).getAttribute('aria-selected')).toBe('true');
  }, 30_000);

  it('shows validated observed workers only in Runtime view without mutating the accepted graph', async () => {
    useGraphStore.getState().loadDynamicParallelismDemo();
    const acceptedBefore = structuredClone(useGraphStore.getState().graph);
    renderWorkspace(false);

    const runtime = await screen.findByRole('radio', { name: 'Runtime' });
    expect((runtime as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(runtime);

    expect(await screen.findByRole('heading', { name: 'Runtime' })).toBeTruthy();
    expect(screen.getByLabelText('Read-only runtime projection')).toBeTruthy();
    expect(screen.queryByText(/observed instances are read-only and do not change the contract/)).toBeNull();
    const instance = document.querySelector<HTMLButtonElement>('.runtime-mode__instance')!;
    expect(instance).toBeTruthy();
    fireEvent.click(instance);
    expect(await screen.findByText(/projection only/i)).toBeTruthy();
    expect(useGraphStore.getState().graph).toEqual(acceptedBefore);
  }, 30_000);

  it('opens the contextual Design inspector while keeping the desktop palette open after palette click creation', async () => {
    renderWorkspace(false);

    const subgraph = await screen.findByRole('button', { name: 'Subgraph' });
    fireEvent.click(subgraph);

    expect(await screen.findByRole('button', { name: 'Collapse inspector' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Edit & review' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse node palette' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse inspector' }));
    expect(screen.getByRole('button', { name: 'Open Inspector' })).toBeTruthy();
  }, 30_000);

  it('opens the contextual Design inspector and replaces the compact palette after palette drop creation', async () => {
    renderWorkspace(true);

    await screen.findByRole('button', { name: 'Subgraph' });
    const canvas = document.querySelector('.react-flow')!;
    fireEvent.drop(canvas, {
      clientX: 640,
      clientY: 360,
      dataTransfer: { getData: () => 'subgraph' },
    });

    expect(await screen.findByRole('button', { name: 'Collapse inspector' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Collapse node palette' })).toBeNull();
    });
  }, 30_000);

  it('creates all four visible work presets as canonical Steps from the mounted palette', async () => {
    renderWorkspace(false);

    const expectedExecutors = {
      Task: 'deterministic',
      Agent: 'ai',
      Tool: 'tool',
      Human: 'human',
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
      { label: 'Task', payload: 'step' },
      { label: 'Agent', payload: 'agent' },
      { label: 'Tool', payload: 'tool' },
      { label: 'Human', payload: 'humanReview' },
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

  it('undoes an invalid edit without racing React Flow selection against history state', async () => {
    useGraphStore.getState().loadResearchIntakeRoutingDemo();
    renderWorkspace(false);
    await screen.findByRole('application');

    act(() => {
      useGraphStore.getState().setSelection({
        nodeIds: [],
        subgraphIds: [],
        edgeIds: ['clarify-write-brief'],
        primary: { type: 'edge', id: 'clarify-write-brief' },
      });
    });
    const routeLabel = await screen.findByRole('textbox', { name: 'Route label' });
    expect((routeLabel as HTMLInputElement).value).toBe('ready');

    fireEvent.change(routeLabel, { target: { value: '' } });
    await waitFor(() => {
      expect(useGraphStore.getState().graph.edges.find(
        (candidate) => candidate.id === 'clarify-write-brief',
      )?.label).toBe('');
      expect(screen.getByText('Every command edge from “Clarify Request” needs a label.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(useGraphStore.getState().graph.edges.find(
        (candidate) => candidate.id === 'clarify-write-brief',
      )?.label).toBe('ready');
      expect(useGraphStore.getState().selection.primary).toEqual({
        type: 'edge',
        id: 'clarify-write-brief',
      });
      expect((screen.getByRole('textbox', { name: 'Route label' }) as HTMLInputElement).value).toBe('ready');
    });
  }, 30_000);

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
    expect(await screen.findByRole('heading', { name: 'Proposal' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Graph overview' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Changes' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Edit & review' })).toBeNull();
    expect(screen.getByRole('button', { name: /Review updated graph\.store/i })).toBeTruthy();
    expect(useGraphStore.getState().graph).toEqual(accepted);

    fireEvent.click(screen.getByRole('button', { name: /Review updated classifier/i }));
    await waitFor(() => {
      expect(document.querySelector('[data-id="classifier"] .contract-node-shell')?.className).toContain('proposal-focus-active');
      expect(document.querySelector('[data-id="classifier"] .contract-node-shell')?.className).toContain('is-selected');
      expect(document.querySelector('[data-id="start"] .contract-node-shell')?.className).toContain('proposal-focus-context');
      expect(document.querySelector('[data-id="refund"] .contract-node-shell')?.className).toContain('proposal-focus-dimmed');
      expect(document.querySelectorAll('.routing-edge__path[class*="proposal-focus-"]')).toHaveLength(0);
    });
    expect(screen.getByRole('heading', { name: 'classifier' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to proposal' }));
    await waitFor(() => {
      expect(document.querySelector('.proposal-focus-active')).toBeNull();
      expect(document.querySelector('.proposal-focus-dimmed')).toBeNull();
    });

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
