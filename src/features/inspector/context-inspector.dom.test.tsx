// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  proposalReviewToCanvasProjection,
  type CanvasReviewProjection,
} from '@/src/adapters/react-flow/project-graph';
import { deriveProposalComparison } from '@/src/application/proposal-comparison';
import { createProposal, researchIntakeRoutingGraph, researchSupervisorGraph, sampleGraph } from '@/src/domain';
import { dynamicParallelismDemoGraph } from '@/src/application/package-three-demo';
import { useGraphStore } from '@/src/state/workspace-store';
import { ContextInspector } from './context-inspector';

const emptySelection = () => ({
  nodeIds: [],
  subgraphIds: [],
  edgeIds: [],
  primary: null,
});

function selectEdge(edgeId: string) {
  useGraphStore.setState({
    selection: {
      nodeIds: [],
      subgraphIds: [],
      edgeIds: [edgeId],
      primary: { type: 'edge', id: edgeId },
    },
  });
}

function selectNode(nodeId: string) {
  useGraphStore.setState({
    selection: {
      nodeIds: [nodeId],
      subgraphIds: [],
      edgeIds: [],
      primary: { type: 'node', id: nodeId },
    },
  });
}

function selectSubgraph(subgraphId: string) {
  useGraphStore.setState({
    selection: {
      nodeIds: [],
      subgraphIds: [subgraphId],
      edgeIds: [],
      primary: { type: 'subgraph', id: subgraphId },
    },
  });
}

function renderInspector(reviewProjection?: CanvasReviewProjection | null) {
  render(
    <ReactFlowProvider>
      <ContextInspector reviewProjection={reviewProjection} />
    </ReactFlowProvider>,
  );
}

function revealModifier(name: string) {
  fireEvent.click(screen.getByText('Add modifier'));
  fireEvent.click(screen.getByRole('menuitem', { name }));
}

beforeEach(() => {
  useGraphStore.setState({
    graph: structuredClone(researchIntakeRoutingGraph),
    proposal: null,
    scenarios: [],
    selection: emptySelection(),
    past: [],
    future: [],
    notice: null,
  });
});

afterEach(() => cleanup());

describe('ContextInspector routing details', () => {
  it('uses one semantic flat shell across graph, node, Merge, End, and Subgraph selections', () => {
    const cases = [
      { graph: structuredClone(sampleGraph), select: () => selectNode('start'), title: 'Start', tone: 'start' },
      { graph: structuredClone(sampleGraph), select: () => selectNode('diagnostic'), title: 'Diagnostic Action', tone: 'task' },
      { graph: structuredClone(sampleGraph), select: () => selectNode('classifier'), title: 'Classifier Agent', tone: 'agent' },
      { graph: structuredClone(sampleGraph), select: () => selectNode('refund'), title: 'Refund Tool', tone: 'tool' },
      { graph: structuredClone(sampleGraph), select: () => selectNode('human'), title: 'Human Input', tone: 'human' },
      { graph: structuredClone(dynamicParallelismDemoGraph), select: () => selectNode('merge-evidence'), title: 'Merge evidence', tone: 'merge' },
      { graph: structuredClone(sampleGraph), select: () => selectNode('end'), title: 'End', tone: 'end' },
      { graph: structuredClone(researchSupervisorGraph), select: () => selectSubgraph('research-supervisor'), title: 'Research Supervisor', tone: 'subgraph' },
    ] as const;

    for (const entry of cases) {
      cleanup();
      useGraphStore.setState({ graph: entry.graph, selection: emptySelection() });
      entry.select();
      renderInspector();

      expect(screen.getByRole('heading', { name: entry.title })).toBeTruthy();
      expect(document.querySelector(`[data-inspector-tone="${entry.tone}"]`)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Focus' })).toBeTruthy();
      expect(screen.queryByText('Node details')).toBeNull();
      expect(screen.queryByText('Subgraph details')).toBeNull();
      expect(screen.queryByText('No proposal waiting')).toBeNull();
    }

    cleanup();
    useGraphStore.setState({ graph: structuredClone(sampleGraph), selection: emptySelection() });
    renderInspector();
    expect(screen.getByRole('heading', { name: sampleGraph.name })).toBeTruthy();
    expect(document.querySelector('[data-inspector-tone="graph"]')).toBeTruthy();
    expect(screen.getByText('Graph settings')).toBeTruthy();
  });

  it('uses semantic source-to-target headers for every routing mode and derived loops', () => {
    const cases = [
      { graph: researchIntakeRoutingGraph, edgeId: 'research-intake-start-clarify', title: 'Start → Clarify Request', tone: 'normal' },
      { graph: researchIntakeRoutingGraph, edgeId: 'supervisor-final-report', title: 'Research Supervisor → Final Report', tone: 'conditional' },
      { graph: researchIntakeRoutingGraph, edgeId: 'clarify-write-brief', title: 'Clarify Request → Write Research Brief', tone: 'command' },
      { graph: researchIntakeRoutingGraph, edgeId: 'supervisor-human-review', title: 'Research Supervisor → Human Review', tone: 'fallback' },
      { graph: researchIntakeRoutingGraph, edgeId: 'researcher-continue', title: 'Researcher → Research Supervisor', tone: 'loop' },
      { graph: dynamicParallelismDemoGraph, edgeId: 'parallel-send-search', title: 'Generate queries → Search evidence', tone: 'send' },
    ] as const;

    for (const entry of cases) {
      cleanup();
      useGraphStore.setState({ graph: structuredClone(entry.graph), selection: emptySelection() });
      selectEdge(entry.edgeId);
      renderInspector();

      expect(screen.getByRole('heading', { name: entry.title })).toBeTruthy();
      expect(document.querySelector(`[data-inspector-tone="${entry.tone}"]`)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Focus' })).toBeTruthy();
      expect(screen.getByText('Routing')).toBeTruthy();
      expect(screen.getByText('Source')).toBeTruthy();
      expect(screen.getByText('Target')).toBeTruthy();
      expect(screen.queryByText('Edge details')).toBeNull();
    }
  });

  it('shows only valid bulk actions for a multi-selection', () => {
    useGraphStore.setState({
      graph: structuredClone(sampleGraph),
      selection: {
        nodeIds: ['classifier', 'billing'],
        subgraphIds: [],
        edgeIds: [],
        primary: { type: 'node', id: 'classifier' },
      },
    });
    renderInspector();

    expect(screen.getByRole('heading', { name: '2 elements selected' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Duplicate selection' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Remove selection' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Basics' })).toBeNull();
  });

  it('edits graph capabilities without drawing topology', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    renderInspector();

    expect(screen.getByText('Graph settings')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Store' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Store available' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Store namespace' }), { target: { value: 'preferences' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Runtime' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Runtime mode' }), { target: { value: 'voice' } });

    expect(useGraphStore.getState().graph.capabilities).toMatchObject({
      store: { available: true, namespace: 'preferences' },
      runtimeMode: { mode: 'voice', input: 'audio' },
    });
  });

  it('edits canonical Step durability without drawing topology', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('billing');
    renderInspector();
    revealModifier('Store access');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Direct Store read' }));
    revealModifier('Retry / fallback policy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Retry policy enabled' }));

    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')).toMatchObject({
      kind: 'step',
      storeAccess: { read: {} },
      retry: { maxAttempts: 2, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
    });
    expect(screen.getByText(/does not add a route, an edge, or a topology loop/)).toBeTruthy();
  });

  it('edits scoped capability overrides without drawing topology', () => {
    const scoped = structuredClone(researchSupervisorGraph);
    scoped.capabilities.store = { available: true };
    useGraphStore.setState({ graph: scoped });
    useGraphStore.setState({
      selection: {
        nodeIds: [],
        subgraphIds: ['research-supervisor'],
        edgeIds: [],
        primary: { type: 'subgraph', id: 'research-supervisor' },
      },
    });
    renderInspector();
    expect(screen.getByText('Durability scope')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Store' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Override Store' }));
    expect(useGraphStore.getState().graph.subgraphs[0]).toMatchObject({
      capabilityOverrides: { store: { available: true } },
    });
  });

  it('keeps Send configuration and Merge reducer controls separate from Step controls', () => {
    useGraphStore.setState({ graph: structuredClone(dynamicParallelismDemoGraph) });
    selectNode('merge-evidence');
    renderInspector();

    expect(screen.getByText('Merge reducer')).toBeTruthy();
    expect(screen.queryByText('Executor')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Merge reducer name' }), {
      target: { value: 'append evidence' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Merge completion policy' }));
    fireEvent.click(screen.getByRole('option', { name: 'Quorum' }));
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'merge-evidence')).toMatchObject({
      kind: 'merge',
      merge: { reducer: { name: 'append evidence' }, completion: { mode: 'quorum', quorum: 1 } },
    });

    cleanup();
    selectEdge('parallel-send-search');
    renderInspector();
    expect(screen.getByText('Send ×N · dynamic worker template')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Send payload label' }), {
      target: { value: 'research query' },
    });
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'parallel-send-search')).toMatchObject({
      mode: 'send',
      send: { destinationTemplateId: 'search-evidence', payloadLabel: 'research query' },
    });
  });

  it('renders a selected runtime instance as a read-only projection surface', () => {
    render(
      <ReactFlowProvider>
        <ContextInspector
          readOnly
          runtimeInstance={{
            runtimeId: 'worker-1',
            sendEdgeId: 'parallel-send-search',
            templateNodeId: 'search-evidence',
            label: 'Search evidence · query 1',
            ordinal: 1,
          }}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('Observed runtime instance')).toBeTruthy();
    expect(screen.getByText(/not part of the accepted graph/)).toBeTruthy();
  });

  it('keeps provenance text inert and exposes opaque, readiness, outcome, and non-native relationship detail', () => {
    const graph = structuredClone(sampleGraph);
    graph.capabilities.provenance.externalOrchestrationAvailable = true;
    const classifier = graph.nodes.find((node) => node.id === 'classifier')!;
    if (classifier.kind !== 'step') throw new Error('Expected classifier Step fixture');
    classifier.opaque = {
      factoryLabel: 'create_prebuilt_agent',
      inputPorts: [{ name: 'request' }],
      outputPorts: [{ name: 'result' }],
      runtimeInspection: { available: false },
    };
    classifier.readiness = { state: 'unimplemented', detail: 'Pending provider integration' };
    classifier.provenance = {
      representation: 'runtime-generated',
      evidence: {
        source: '<img src=x onerror=alert(1)>',
        evidenceClass: 'Factory record',
        confidence: 'high',
        details: 'Read-only source text',
      },
    };
    useGraphStore.setState({ graph });
    selectNode('classifier');
    render(
      <ReactFlowProvider>
        <ContextInspector
          evidence={{ number: 2, target: 'node', id: 'classifier', label: 'Classifier', provenance: classifier.provenance, nativeControlEdge: false }}
          relationship={{
            id: 'background-notify',
            kind: 'external-orchestration',
            source: { kind: 'node', nodeId: 'classifier' },
            target: { kind: 'external', externalId: 'background-runner', label: 'Background runner' },
            label: 'Notify runner',
            provenance: {
              representation: 'external-orchestration',
              evidence: { source: 'runner config', evidenceClass: 'System boundary', confidence: 'high' },
            },
          }}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('Evidence details · #2')).toBeTruthy();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('External orchestration')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notify runner' })).toBeTruthy();
    expect(document.querySelector('[data-inspector-tone="relationship"]')).toBeTruthy();
    expect(screen.getByText(/Not a native control edge/)).toBeTruthy();
    expect(screen.getByText('Opaque / prebuilt Step')).toBeTruthy();
    expect(screen.getByText('Unimplemented')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Readiness detail' }) as HTMLTextAreaElement).value).toBe('Pending provider integration');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Inspect at runtime' }).disabled).toBe(true);
  });

  it('authors canonical opaque metadata and keeps its durable interface editable only in draft authority', async () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('classifier');
    renderInspector();

    revealModifier('Guardrail, readiness, or opaque boundary');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Opaque or prebuilt' }));
    let classifier = useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier');
    expect(classifier).toMatchObject({
      kind: 'step',
      opaque: {
        factoryLabel: 'Classifier Agent factory',
        inputPorts: [],
        outputPorts: [],
        runtimeInspection: { available: false },
      },
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Opaque factory label' }), {
      target: { value: 'create_support_classifier' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Opaque input ports' }), {
      target: { value: 'request, context, request' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Opaque output ports' }), {
      target: { value: 'decision, explanation' },
    });
    classifier = useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier');
    expect(classifier).toMatchObject({
      kind: 'step',
      opaque: {
        factoryLabel: 'create_support_classifier',
        inputPorts: [{ name: 'request' }, { name: 'context' }],
        outputPorts: [{ name: 'decision' }, { name: 'explanation' }],
        runtimeInspection: { available: false },
      },
    });
    expect(document.getElementById('opaque-input-ports-classifier')).toBeTruthy();
    expect(document.getElementById('opaque-output-ports-classifier')).toBeTruthy();

    useGraphStore.setState({
      graph: { ...useGraphStore.getState().graph, status: 'frozen' },
    });
    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'Opaque factory label' }) as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByRole('textbox', { name: 'Opaque input ports' }) as HTMLInputElement).disabled).toBe(true);
    });

    useGraphStore.setState({
      graph: { ...useGraphStore.getState().graph, status: 'draft' },
    });
    await waitFor(() => {
      expect((screen.getByRole('checkbox', { name: 'Opaque or prebuilt' }) as HTMLInputElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Opaque or prebuilt' }));
    classifier = useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier');
    expect(classifier).toMatchObject({ kind: 'step' });
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected classifier Step fixture.');
    expect(classifier.opaque).toBeUndefined();
    expect(classifier.modifiers?.opaque).toBeUndefined();
  });

  it('edits the v3 HITL response contract and sensitive policy independently', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('classifier');
    renderInspector();

    revealModifier('Human input gate');
    fireEvent.click(screen.getByRole('checkbox', { name: 'HITL enabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'HITL timing' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inside' }));
    fireEvent.click(screen.getByRole('button', { name: 'HITL response type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Selection' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Human input gate reason' }), {
      target: { value: 'A support owner must review the request.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Outcome 1 label' }), {
      target: { value: 'Route approved support work' },
    });
    revealModifier('Sensitive effect');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sensitive effect policy enabled' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Sensitive mutation target' }), {
      target: { value: 'Customer billing record' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Sensitive authorization' }), {
      target: { value: 'Billing administrator' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Approval required' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Sensitive idempotency' }), {
      target: { value: 'Ticket ID' },
    });

    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier')).toMatchObject({
      kind: 'step',
      hitl: {
        enabled: true,
        timing: 'inside',
        activation: { reason: 'A support owner must review the request.' },
        response: {
          type: 'selection',
          selectionChoices: expect.any(Array),
          allowedOutcomes: expect.any(Array),
        },
      },
      sensitive: {
        target: 'Customer billing record',
        authorization: 'Billing administrator',
        approvalRequired: true,
        idempotency: 'Ticket ID',
      },
    });
    const classifier = useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier');
    expect(classifier).toMatchObject({
      hitl: { enabled: true, timing: 'inside', response: { type: 'selection' } },
      sensitive: { target: 'Customer billing record' },
    });
    expect(classifier?.kind === 'step' && classifier.hitl?.response?.allowedOutcomes[0]?.label).toBe(
      'Route approved support work',
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'HITL enabled' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'HITL enabled' }));
    expect(
      useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier'),
    ).toMatchObject({ hitl: { enabled: true, response: { type: 'selection' } } });
  }, 30_000);

  it('previews configured human outcomes locally without changing the accepted graph', () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected Step fixture.');
    classifier.hitl = {
      enabled: true,
      timing: 'before',
      activation: { reason: 'A person must approve billing work.' },
      response: {
        type: 'approval',
        allowedOutcomes: [
          { id: 'approve', label: 'Approve', resumeNodeId: 'billing' },
          { id: 'request-changes', label: 'Request changes', resumeNodeId: 'diagnostic' },
        ],
      },
    };
    useGraphStore.setState({ graph });
    const beforePreview = structuredClone(useGraphStore.getState().graph);
    selectNode('classifier');
    renderInspector();

    const previewTrigger = screen.getByRole('button', { name: 'Preview input request' });
    fireEvent.click(previewTrigger);
    expect(screen.getByRole('dialog', { name: 'Preview input request' })).toBeTruthy();
    expect(screen.getByText(/Preview only — no runtime execution/)).toBeTruthy();
    expect(screen.getByText(/Only a human can choose this preview response/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close input request preview' }));
    fireEvent.click(screen.getByRole('radio', { name: /Approve\s*Would resume at Billing Agent/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected response' }));
    expect(screen.getByText(/would resume at Billing Agent · billing/)).toBeTruthy();
    expect(useGraphStore.getState().graph).toEqual(beforePreview);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Preview input request' })).toBeNull();
    expect(document.activeElement).toBe(previewTrigger);
  });

  it('clears an open preview when selection or accepted status changes', async () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected Step fixture.');
    classifier.hitl = {
      enabled: true,
      timing: 'before',
      response: {
        type: 'approval',
        allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'billing' }],
      },
    };
    useGraphStore.setState({ graph });
    selectNode('classifier');
    renderInspector();

    fireEvent.click(screen.getByRole('button', { name: 'Preview input request' }));
    expect(screen.getByRole('dialog', { name: 'Preview input request' })).toBeTruthy();
    selectNode('billing');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview input request' })).toBeNull());

    cleanup();
    useGraphStore.setState({ graph, selection: emptySelection() });
    selectNode('classifier');
    renderInspector();
    fireEvent.click(screen.getByRole('button', { name: 'Preview input request' }));
    useGraphStore.setState({ graph: { ...graph, status: 'frozen' } });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview input request' })).toBeNull());
  });

  it('keeps HITL and sensitive policy fields read-only for frozen and proposal review graphs', () => {
    const graph = structuredClone(sampleGraph);
    const classifier = graph.nodes.find((node) => node.id === 'classifier');
    if (!classifier || classifier.kind !== 'step') throw new Error('Expected Step fixture.');
    classifier.hitl = {
      enabled: true,
      timing: 'before',
      response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'billing' }] },
    };
    classifier.sensitive = {
      target: 'Billing', authorization: 'Admin', approvalRequired: true, idempotency: 'Ticket',
    };
    useGraphStore.setState({ graph: { ...graph, status: 'frozen' } });
    selectNode('classifier');
    renderInspector();
    expect((screen.getByRole('checkbox', { name: 'HITL enabled' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Outcome 1 label' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Sensitive effect policy enabled' }) as HTMLInputElement).disabled).toBe(true);

    cleanup();
    const proposal = createProposal(graph, {
      rationale: 'Rename classifier for review.',
      operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label: 'Classifier proposal' } }],
    }).proposal!;
    const reviewProjection = proposalReviewToCanvasProjection(
      deriveProposalComparison(graph, proposal),
    );
    useGraphStore.setState({ graph, proposal });
    selectNode('classifier');
    renderInspector(reviewProjection);
    expect((screen.getByRole('button', { name: 'HITL timing' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Sensitive authorization' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('uses one candidate display graph for proposal durability and subgraph membership details', () => {
    const graph = structuredClone(researchSupervisorGraph);
    const proposal = createProposal(graph, {
      rationale: 'Review the complete scoped durability and membership candidate.',
      operations: [
        {
          type: 'update_subgraph',
          subgraphId: 'research-supervisor',
          patch: { label: 'Proposed Research Supervisor' },
        },
        {
          type: 'set_subgraph_capability_override',
          subgraphId: 'research-supervisor',
          override: { store: { available: true, namespace: 'proposal-memory' } },
        },
        {
          type: 'remove_nodes_from_subgraph',
          nodeIds: ['research-supervisor-tools'],
        },
      ],
    }).proposal!;
    const reviewProjection = proposalReviewToCanvasProjection(
      deriveProposalComparison(graph, proposal),
    );
    useGraphStore.setState({
      graph,
      proposal,
      selection: {
        nodeIds: [],
        subgraphIds: ['research-supervisor'],
        edgeIds: [],
        primary: { type: 'subgraph', id: 'research-supervisor' },
      },
    });

    renderInspector(reviewProjection);

    expect((screen.getByDisplayValue('Proposed Research Supervisor') as HTMLInputElement).disabled).toBe(true);
    expect(document.querySelector('.context-inspector__member-count')?.textContent).toBe('3');
    expect(screen.queryByText('Supervisor Tools')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Store' }));
    expect((screen.getByRole('checkbox', { name: 'Override Store' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Override Store' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Store namespace' }) as HTMLInputElement).value).toBe('proposal-memory');
    expect(graph.subgraphs[0].label).toBe('Research Supervisor');
    expect(graph.nodes.filter((node) => node.parentId === 'research-supervisor')).toHaveLength(4);
  });

  it('keeps Start and End structural so no Step-only fields are exposed', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('start');
    renderInspector();

    expect(screen.getByRole('heading', { name: 'Start' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Basics' })).toBeTruthy();
    expect(screen.queryByText('Node details')).toBeNull();
    expect(screen.queryByText('Inspector')).toBeNull();
    expect(screen.queryByText('Executor')).toBeNull();
    expect(screen.queryByText('Participation')).toBeNull();
    expect(screen.queryByText('Human input')).toBeNull();
    expect(screen.queryByText('Modifier summary')).toBeNull();

    cleanup();
    useGraphStore.setState({ graph: structuredClone(sampleGraph), selection: emptySelection() });
    selectNode('end');
    renderInspector();
    fireEvent.click(screen.getByRole('button', { name: 'End outcome kind' }));
    fireEvent.click(screen.getByRole('option', { name: 'Partial result' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'End outcome detail' }), {
      target: { value: 'Some requests could not be completed.' },
    });
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'end')).toMatchObject({
      outcome: { kind: 'partial-result', detail: 'Some requests could not be completed.' },
    });
  });

  it('edits a command route label, condition, and destination through undoable store actions', () => {
    selectEdge('clarify-write-brief');
    renderInspector();

    const routeMode = screen.getByRole('button', { name: 'Routing mode' });
    fireEvent.click(routeMode);
    expect(screen.getByRole('option', { name: 'Command' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Fallback' })).toBeTruthy();
    fireEvent.keyDown(routeMode, { key: 'Escape' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Route label' }), {
      target: { value: 'ready for review' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Condition' }), {
      target: { value: 'state.reviewReady === true' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Destination' }));
    fireEvent.click(screen.getByRole('option', { name: 'Report complete · end' }));

    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')).toMatchObject({
      mode: 'command',
      label: 'ready for review',
      condition: 'state.reviewReady === true',
      target: 'report-complete',
    });

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')?.target).toBe(
      'write-research-brief',
    );
    useGraphStore.getState().redo();
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')?.target).toBe(
      'report-complete',
    );
  });

  it('makes fallback role and topology-derived loop cues explicit', () => {
    selectEdge('supervisor-human-review');
    renderInspector();
    expect(screen.getByText(/Fallback route: used after the source’s conditional routes/)).toBeTruthy();

    cleanup();
    selectEdge('researcher-continue');
    renderInspector();
    expect(screen.getByText('Derived loop: this route returns to an earlier reachable node.')).toBeTruthy();
  });

  it('normalizes route data through the canonical store path when modes switch', () => {
    selectEdge('clarify-write-brief');
    renderInspector();

    fireEvent.click(screen.getByRole('button', { name: 'Routing mode' }));
    fireEvent.click(screen.getByRole('option', { name: 'Edge' }));
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')).toMatchObject({
      mode: 'normal',
      label: 'ready',
    });
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')).not.toHaveProperty('condition');

    fireEvent.click(screen.getByRole('button', { name: 'Routing mode' }));
    fireEvent.click(screen.getByRole('option', { name: 'Fallback' }));
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')).toMatchObject({
      id: 'clarify-write-brief',
      source: 'clarify-request',
      target: 'write-research-brief',
      mode: 'fallback',
      label: 'fallback',
    });
  });

  it('shows route-specific validation help without disabling a draft inspector', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '   ';
    useGraphStore.setState({ graph: invalid });
    selectEdge('supervisor-final-report');
    renderInspector();

    expect(screen.getByRole('alert').textContent).toContain(
      'Every conditional edge from “Research Supervisor” needs a label.',
    );
    expect((screen.getByRole('textbox', { name: 'Route label' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('renders proposal preview and frozen routing details as read-only', () => {
    const proposal = createProposal(researchIntakeRoutingGraph, {
      rationale: 'Update the command label for human review.',
      operations: [
        {
          type: 'update_edge',
          edgeId: 'clarify-write-brief',
          patch: { label: 'reviewed command' },
        },
      ],
    }).proposal!;
    const reviewProjection = proposalReviewToCanvasProjection(
      deriveProposalComparison(researchIntakeRoutingGraph, proposal),
    );
    // The supplied review remains authoritative even if raw proposal data is
    // subsequently incomplete or points at another replay result.
    proposal.operations = [{
      type: 'update_edge',
      edgeId: 'clarify-write-brief',
      patch: { label: 'wrong raw replay label' },
    }];
    proposal.diff.updatedEdgeIds = [];
    useGraphStore.setState({ proposal });
    selectEdge('clarify-write-brief');
    renderInspector(reviewProjection);

    expect((screen.getByDisplayValue('reviewed command') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByDisplayValue('wrong raw replay label')).toBeNull();
    expect(screen.getByText(/Proposal preview: updated route/)).toBeTruthy();
    expect(screen.getByText(/human must approve or reject/)).toBeTruthy();

    cleanup();
    useGraphStore.setState({
      graph: { ...structuredClone(researchIntakeRoutingGraph), status: 'frozen' },
      proposal: null,
    });
    selectEdge('clarify-write-brief');
    renderInspector();

    expect(screen.getByText('Frozen: this route is read-only.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Routing mode' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('menuitem', { name: 'Remove edge' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
