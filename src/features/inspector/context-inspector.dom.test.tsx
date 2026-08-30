// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createProposal, researchIntakeRoutingGraph, sampleGraph } from '@/src/domain';
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

function renderInspector() {
  render(
    <ReactFlowProvider>
      <ContextInspector />
    </ReactFlowProvider>,
  );
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

  it('edits the v3 HITL response contract and sensitive policy independently', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('classifier');
    renderInspector();

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
    useGraphStore.setState({ graph, proposal });
    selectNode('classifier');
    renderInspector();
    expect((screen.getByRole('button', { name: 'HITL timing' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Sensitive authorization' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps Start and End structural so no Step-only fields are exposed', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('start');
    renderInspector();

    expect(screen.getByText('Node details')).toBeTruthy();
    expect(screen.queryByText('Executor')).toBeNull();
    expect(screen.queryByText('Participation')).toBeNull();
    expect(screen.queryByText('Human input')).toBeNull();
    expect(screen.queryByText('Modifier summary')).toBeNull();
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
    expect(useGraphStore.getState().graph.edges.find((edge) => edge.id === 'clarify-write-brief')).toEqual({
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
    useGraphStore.setState({ proposal });
    selectEdge('clarify-write-brief');
    renderInspector();

    expect((screen.getByDisplayValue('reviewed command') as HTMLInputElement).disabled).toBe(true);
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
    expect((screen.getByRole('button', { name: 'Remove edge' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
