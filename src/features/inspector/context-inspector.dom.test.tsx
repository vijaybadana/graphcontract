// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createProposal, researchIntakeRoutingGraph, sampleGraph } from '@/src/domain';
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
  it('edits normalized Step executor, participation, HITL, and modifier summaries independently', () => {
    useGraphStore.setState({ graph: structuredClone(sampleGraph) });
    selectNode('classifier');
    renderInspector();

    fireEvent.click(screen.getByRole('button', { name: 'Step executor' }));
    fireEvent.click(screen.getByRole('option', { name: 'Tool' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Internal tools' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'HITL timing' }));
    fireEvent.click(screen.getByRole('option', { name: 'After' }));
    fireEvent.click(screen.getByRole('button', { name: 'HITL input type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Text' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Human input condition' }), {
      target: { value: 'risk.requiresReview === true' },
    });
    for (const label of [
      'Guardrail',
      'Sensitive side effect',
      'Store read',
      'Store write',
      'Retry or fallback',
      'Opaque or prebuilt',
    ]) {
      fireEvent.click(screen.getByRole('checkbox', { name: label }));
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Readiness' }), {
      target: { value: 'degraded' },
    });

    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier')).toMatchObject({
      kind: 'step',
      executor: 'tool',
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'after',
        inputType: 'text',
        condition: 'risk.requiresReview === true',
      },
      modifiers: {
        guardrail: true,
        sensitiveSideEffect: true,
        storeRead: true,
        storeWrite: true,
        retryFallback: true,
        opaque: true,
        readiness: 'degraded',
      },
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Store read' }));
    const classifier = useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier');
    expect(classifier).toMatchObject({
      executor: 'tool',
      hitl: { enabled: true, timing: 'after', inputType: 'text' },
      modifiers: { sensitiveSideEffect: true, storeWrite: true, readiness: 'degraded' },
    });
    expect(classifier?.kind === 'step' && classifier.modifiers?.storeRead).toBeUndefined();
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
