import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sampleGraph, validateGraph } from '@/src/domain';
import type { WorkspaceSelection } from './workspace-store';

const persisted = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => persisted.get(key) ?? null,
  setItem: (key: string, value: string) => persisted.set(key, value),
  removeItem: (key: string) => persisted.delete(key),
});

const { useGraphStore } = await import('./workspace-store');

const emptySelection = (): WorkspaceSelection => ({
  nodeIds: [],
  subgraphIds: [],
  edgeIds: [],
  primary: null,
});

beforeEach(() => {
  persisted.clear();
  useGraphStore.getState().resetGraph();
  useGraphStore.setState({
    selection: emptySelection(),
    clipboardNodeIds: [],
    past: [],
    future: [],
    notice: null,
    fitViewRevision: 0,
  });
});

describe('workspace subgraph actions', () => {
  it('auto-lays out the accepted graph as one undoable selection-clearing action', () => {
    const original = structuredClone(useGraphStore.getState().graph);
    const graph = structuredClone(original);
    graph.nodes.find((node) => node.id === 'billing')!.position = { x: 5000, y: 5000 };
    useGraphStore.setState({
      graph,
      selection: {
        nodeIds: ['billing'],
        subgraphIds: [],
        edgeIds: [],
        primary: { type: 'node', id: 'billing' },
      },
    });
    const revision = useGraphStore.getState().fitViewRevision;

    useGraphStore.getState().autoLayout();

    expect(useGraphStore.getState()).toMatchObject({
      selection: emptySelection(),
      fitViewRevision: revision + 1,
    });
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')?.position).not.toEqual({
      x: 5000,
      y: 5000,
    });
    expect(useGraphStore.getState().past).toHaveLength(1);

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')?.position).toEqual({
      x: 5000,
      y: 5000,
    });
  });

  it('keeps Auto-layout inert while a proposal is pending or the graph is frozen', () => {
    const original = structuredClone(useGraphStore.getState().graph);
    expect(useGraphStore.getState().submitProposal({
      rationale: 'Review a label only.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } }],
    }).ok).toBe(true);
    useGraphStore.getState().autoLayout();
    expect(useGraphStore.getState().graph).toEqual(original);

    useGraphStore.getState().rejectProposal();
    expect(useGraphStore.getState().freezeGraph().ok).toBe(true);
    useGraphStore.getState().autoLayout();
    expect(useGraphStore.getState().graph.status).toBe('frozen');
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')?.position).toEqual(
      original.nodes.find((node) => node.id === 'billing')?.position,
    );
    useGraphStore.getState().unfreezeGraph();
  });
  it('creates, moves, and dissolves a selected container in one canvas history transition', () => {
    useGraphStore.getState().createSubgraph({ position: { x: 300, y: 80 } });
    const created = useGraphStore.getState();
    const subgraphId = created.selection.primary?.id;
    expect(created.selection.primary?.type).toBe('subgraph');
    expect(subgraphId).toBeTruthy();

    useGraphStore.getState().assignNodesToSubgraph(subgraphId!, ['billing']);
    useGraphStore.getState().moveCanvasElements({
      [subgraphId!]: { x: 420, y: 180 },
      billing: { x: 70, y: 38 },
    });
    const moved = useGraphStore.getState();

    expect(moved.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId)?.position).toEqual({
      x: 420,
      y: 180,
    });
    expect(moved.graph.nodes.find((node) => node.id === 'billing')?.position).toEqual({
      x: 70,
      y: 38,
    });
    expect(moved.past).toHaveLength(3);

    useGraphStore.getState().dissolveSubgraph(subgraphId!);
    expect(useGraphStore.getState().graph.subgraphs).toEqual([]);
    const billing = useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing');
    expect(billing?.position).toEqual({ x: 490, y: 218 });
    expect(billing).not.toHaveProperty('parentId');
    expect(useGraphStore.getState().selection).toEqual(emptySelection());
  });

  it('protects a selected edge after collapse and makes it deletable again after expansion', () => {
    const initial = useGraphStore.getState();
    const originalEdges = structuredClone(initial.graph.edges);
    useGraphStore.getState().createSubgraph({ position: { x: 300, y: 80 } });
    const subgraphId = useGraphStore.getState().selection.primary!.id;
    useGraphStore.getState().assignNodesToSubgraph(subgraphId, ['billing']);
    useGraphStore.getState().setSelection({
      nodeIds: [],
      subgraphIds: [],
      edgeIds: ['billing-refund'],
      primary: { type: 'edge', id: 'billing-refund' },
    });
    useGraphStore.getState().setSubgraphCollapsed(subgraphId, true);
    useGraphStore.getState().deleteSelection();
    expect(useGraphStore.getState().graph.edges).toEqual(originalEdges);

    useGraphStore.getState().setSubgraphCollapsed(subgraphId, false);
    useGraphStore.getState().deleteSelection();
    expect(useGraphStore.getState().graph.edges.some((edge) => edge.id === 'billing-refund')).toBe(false);
  });

  it('loads the separate demo explicitly', () => {
    const previousGraphId = useGraphStore.getState().graph.id;
    useGraphStore.getState().loadResearchSupervisorDemo();
    expect(useGraphStore.getState().graph.id).toBe('research-supervisor-demo');
    expect(useGraphStore.getState().selection).toEqual(emptySelection());

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.id).toBe(previousGraphId);
  });

  it('loads Research Intake Routing as an undoable, explicitly requested replacement', () => {
    const previousGraphId = useGraphStore.getState().graph.id;
    useGraphStore.getState().loadResearchIntakeRoutingDemo();
    expect(useGraphStore.getState().graph).toMatchObject({
      id: 'research-intake-routing-demo',
      name: 'Research Intake Routing',
    });
    expect(useGraphStore.getState().selection).toEqual(emptySelection());

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.id).toBe(previousGraphId);
  });

  it('loads a library entry as one undoable edit and clears transient canvas state', () => {
    const previousGraphId = useGraphStore.getState().graph.id;
    useGraphStore.setState({
      runtimeProjectionFixture: {
        graphId: previousGraphId,
        graphUpdatedAt: useGraphStore.getState().graph.updatedAt,
        instances: [],
      },
      clipboardNodeIds: ['billing'],
      selection: {
        nodeIds: ['billing'],
        subgraphIds: [],
        edgeIds: [],
        primary: { type: 'node', id: 'billing' },
      },
    });
    const fitRevision = useGraphStore.getState().fitViewRevision;
    const graph = { ...structuredClone(sampleGraph), id: 'library-entry-graph', name: 'Library entry' };

    expect(useGraphStore.getState().loadGraphLibraryEntry({ title: 'Library entry', graph })).toBe(true);
    expect(useGraphStore.getState()).toMatchObject({
      graph: { id: 'library-entry-graph', status: 'draft' },
      runtimeProjectionFixture: null,
      clipboardNodeIds: [],
      selection: emptySelection(),
      fitViewRevision: fitRevision + 1,
    });

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.id).toBe(previousGraphId);
  });

  it('loads the Human Control & HITL demo as an undoable, explicitly requested replacement', () => {
    const previousGraphId = useGraphStore.getState().graph.id;
    useGraphStore.getState().loadHumanControlHitlDemo();
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'deploy-change')).toMatchObject({
      kind: 'step',
      hitl: {
        response: {
          allowedOutcomes: expect.arrayContaining([
            expect.objectContaining({ id: 'approve' }),
            expect.objectContaining({ id: 'request-changes' }),
            expect.objectContaining({ id: 'reject' }),
          ]),
        },
      },
      sensitive: { approvalRequired: true },
    });

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.id).toBe(previousGraphId);
  });

  it('commits a normal-node drop and parent assignment as one history transition', () => {
    useGraphStore.getState().createSubgraph({
      position: { x: 400, y: 40 },
      dimensions: { width: 600, height: 360 },
    });
    const subgraphId = useGraphStore.getState().selection.primary!.id;
    const historyBeforeDrop = useGraphStore.getState().past.length;

    useGraphStore.getState().moveCanvasElements({ billing: { x: 620, y: 150 } });
    const billing = useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing');

    expect(billing).toMatchObject({ parentId: subgraphId, position: { x: 220, y: 110 } });
    expect(useGraphStore.getState().past).toHaveLength(historyBeforeDrop + 1);
  });
});

describe('workspace persistence reload', () => {
  it('keeps canonical Step fields through copy/paste, undo/redo, and persisted rehydration', async () => {
    useGraphStore.getState().addNode('agent', { x: 900, y: 120 });
    const originalId = useGraphStore.getState().selection.primary!.id;
    useGraphStore.getState().updateNode(originalId, {
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'before',
        response: {
          type: 'approval',
          allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'end' }],
        },
      },
      sensitive: {
        target: 'Customer record',
        authorization: 'Support lead',
        approvalRequired: false,
        idempotency: 'Support request ID',
      },
      modifiers: { guardrail: true, storeRead: true },
    });
    useGraphStore.getState().copySelection();
    useGraphStore.getState().pasteSelection();

    const copyId = useGraphStore.getState().selection.primary!.id;
    const expectedStep = {
      kind: 'step',
      executor: 'ai',
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'before',
        response: {
          type: 'approval',
          allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'end' }],
        },
      },
      sensitive: {
        target: 'Customer record',
        authorization: 'Support lead',
        approvalRequired: false,
        idempotency: 'Support request ID',
      },
      modifiers: { guardrail: true, storeRead: true },
    };
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === copyId)).toMatchObject(
      expectedStep,
    );

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.nodes.some((node) => node.id === copyId)).toBe(false);
    useGraphStore.getState().redo();
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === copyId)).toMatchObject(
      expectedStep,
    );

    await useGraphStore.persist.rehydrate();
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === copyId)).toMatchObject(
      expectedStep,
    );
  });

  it('rehydrates an incomplete, schema-safe draft instead of replacing it with the sample', async () => {
    const draft = structuredClone(sampleGraph);
    draft.nodes.push({
      id: 'unfinished-agent',
      kind: 'step',
      executor: 'ai',
      label: 'Unfinished agent',
      position: { x: 900, y: 120 },
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'after',
        response: {
          type: 'text',
          allowedOutcomes: [{ id: 'continue', label: 'Continue', resumeNodeId: 'end' }],
        },
      },
      modifiers: { retryFallback: true, readiness: 'degraded' },
    });
    draft.edges.push({
      id: 'unfinished-edge',
      source: 'diagnostic',
      target: 'not-yet-created',
      mode: 'normal',
    });
    draft.subgraphs.push({
      id: 'empty-subgraph',
      label: 'Unfinished subgraph',
      position: { x: 900, y: 280 },
      dimensions: { width: 320, height: 200 },
      collapsed: false,
    });
    persisted.set(
      'graphcontract-workspace-v1',
      JSON.stringify({ state: { graph: draft, proposal: null, scenarios: [] }, version: 4 }),
    );

    await useGraphStore.persist.rehydrate();

    expect(useGraphStore.getState().graph).toMatchObject({
      nodes: expect.arrayContaining([expect.objectContaining({ id: 'unfinished-agent' })]),
      edges: expect.arrayContaining([
        expect.objectContaining({
          id: 'unfinished-edge',
          source: 'diagnostic',
          target: 'not-yet-created',
        }),
      ]),
      subgraphs: expect.arrayContaining([expect.objectContaining({ id: 'empty-subgraph' })]),
    });
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'unfinished-agent')).toMatchObject({
      kind: 'step',
      executor: 'ai',
      participation: { internalTools: true },
      hitl: {
        enabled: true,
        timing: 'after',
        response: {
          type: 'text',
          allowedOutcomes: [{ id: 'continue', label: 'Continue', resumeNodeId: 'end' }],
        },
      },
      modifiers: { retryFallback: true, readiness: 'degraded' },
    });
    expect(validateGraph(useGraphStore.getState().graph).map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['MISSING_EDGE_NODE', 'OUTGOING_REQUIRED', 'SUBGRAPH_START_COUNT']),
    );
  });
});

describe('workspace reset authority', () => {
  it('does not reset accepted state or a proposal under review', () => {
    const accepted = structuredClone(useGraphStore.getState().graph);
    const submitted = useGraphStore.getState().submitProposal({
      rationale: 'Clarify the billing specialist.',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    });
    expect(submitted.ok).toBe(true);
    const proposal = structuredClone(useGraphStore.getState().proposal);

    useGraphStore.getState().resetGraph();

    expect(useGraphStore.getState().graph).toEqual(accepted);
    expect(useGraphStore.getState().proposal).toEqual(proposal);
    expect(useGraphStore.getState().notice).toBe(
      'Approve or reject the agent proposal before editing the accepted graph.',
    );
  });
});
