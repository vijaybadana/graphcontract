import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enumerateScenarios, normalizeWorkflowGraph, sampleGraph, validateGraph } from '@/src/domain';
import { graphLibraryEntries } from '@/src/application/graph-library';
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
    reviewRequest: null,
    selection: emptySelection(),
    clipboardNodeIds: [],
    past: [],
    future: [],
    notice: null,
    layoutPending: false,
    fitViewRevision: 0,
  });
});

describe('workspace subgraph actions', () => {
  it('edits durability capabilities and direct Step policies as undoable, non-topology actions', () => {
    const topology = () => ({
      nodes: useGraphStore.getState().graph.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        parentId: node.parentId,
        position: node.position,
      })),
      edges: structuredClone(useGraphStore.getState().graph.edges),
      subgraphs: structuredClone(useGraphStore.getState().graph.subgraphs),
    });
    const beforeTopology = topology();

    useGraphStore.getState().updateGraphCapabilities({
      store: { available: true, namespace: 'preferences', retention: 'session' },
      runtimeMode: { mode: 'text', input: 'text' },
    });
    useGraphStore.getState().updateStepStoreAccess('billing', {
      read: { namespace: 'preferences', key: 'customer' },
    });
    useGraphStore.getState().updateStepRetry('billing', {
      maxAttempts: 3,
      backoff: { strategy: 'exponential', initialDelayMs: 100 },
    });

    expect(useGraphStore.getState().graph).toMatchObject({
      capabilities: {
        store: { available: true, namespace: 'preferences', retention: 'session' },
        runtimeMode: { mode: 'text', input: 'text' },
      },
    });
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')).toMatchObject({
      kind: 'step',
      storeAccess: { read: { namespace: 'preferences', key: 'customer' } },
      retry: { maxAttempts: 3, backoff: { strategy: 'exponential', initialDelayMs: 100 } },
      modifiers: { storeRead: true, retryFallback: true },
    });
    expect(topology()).toEqual(beforeTopology);

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')).not.toHaveProperty('retry');
  });

  it('keeps direct durability edits inert while proposal review is pending or the graph is frozen', () => {
    const before = structuredClone(useGraphStore.getState().graph);
    expect(useGraphStore.getState().submitProposal({
      rationale: 'Review an independent label update.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } }],
    }).ok).toBe(true);
    useGraphStore.getState().updateGraphCapabilities({ store: { available: true } });
    useGraphStore.getState().updateStepRetry('billing', {
      maxAttempts: 2,
      backoff: { strategy: 'fixed', initialDelayMs: 0 },
    });
    expect(useGraphStore.getState().graph).toEqual(before);

    useGraphStore.getState().rejectProposal();
    expect(useGraphStore.getState().freezeGraph().ok).toBe(true);
    useGraphStore.getState().updateStepStoreAccess('billing', { read: {} });
    expect(useGraphStore.getState().graph.status).toBe('frozen');
    expect(useGraphStore.getState().graph.capabilities).toEqual(before.capabilities);
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'billing')).not.toHaveProperty('storeAccess');
    useGraphStore.getState().unfreezeGraph();
  });

  it('auto-lays out the accepted graph as one undoable selection-clearing action', async () => {
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

    await vi.waitFor(() => {
      expect(useGraphStore.getState().fitViewRevision).toBe(revision + 1);
    });

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

  it('coalesces structural layouts and never lets an older result overwrite a newer edit', async () => {
    const revision = useGraphStore.getState().fitViewRevision;
    useGraphStore.getState().addNode('agent', { x: 5000, y: 5000 });
    const firstId = useGraphStore.getState().selection.primary?.id;
    useGraphStore.getState().addNode('tool', { x: 6000, y: 6000 });
    const secondId = useGraphStore.getState().selection.primary?.id;

    await vi.waitFor(() => {
      expect(useGraphStore.getState().fitViewRevision).toBe(revision + 1);
    });
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === firstId)?.position.x).toBeLessThan(5000);
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === secondId)?.position.x).toBeLessThan(6000);
    expect(useGraphStore.getState().past).toHaveLength(2);
  });

  it('keeps proposal submission and freeze behind the accepted-layout boundary', async () => {
    useGraphStore.getState().addNode('agent', { x: 5000, y: 5000 });
    expect(useGraphStore.getState().layoutPending).toBe(true);

    const proposal = useGraphStore.getState().submitProposal({
      rationale: 'Do not derive a proposal from transient geometry.',
      operations: [{ type: 'update_node', nodeId: 'billing', patch: { label: 'Billing review' } }],
    });
    expect(proposal).toMatchObject({ ok: false, error: { code: 'LAYOUT_PENDING' } });
    expect(useGraphStore.getState().proposal).toBeNull();
    expect(useGraphStore.getState().freezeGraph()).toMatchObject({
      ok: false,
      issues: [{ code: 'LAYOUT_PENDING' }],
    });

    await vi.waitFor(() => expect(useGraphStore.getState().layoutPending).toBe(false));
  });

  it('lays out an unresolved rapid-edit snapshot when Undo restores it', async () => {
    useGraphStore.getState().addNode('agent', { x: 5000, y: 5000 });
    const firstId = useGraphStore.getState().selection.primary?.id;
    useGraphStore.getState().addNode('tool', { x: 6000, y: 6000 });

    await vi.waitFor(() => expect(useGraphStore.getState().layoutPending).toBe(false));
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.nodes.some((node) => node.id === firstId)).toBe(true);

    await vi.waitFor(() => expect(useGraphStore.getState().layoutPending).toBe(false));
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === firstId)?.position.x).toBeLessThan(5000);
  });

  it('keeps proposal-authored positions without mutating or re-laying out the accepted graph', () => {
    const accepted = structuredClone(useGraphStore.getState().graph);
    const result = useGraphStore.getState().submitProposal({
      rationale: 'Insert a reviewed fraud check.',
      operations: [
        { type: 'remove_edge', edgeId: 'billing-refund' },
        {
          type: 'add_node',
          node: {
            id: 'fraud-check',
            kind: 'step',
            executor: 'deterministic',
            label: 'Fraud check',
            position: { x: 5000, y: 5000 },
          },
        },
        { type: 'add_edge', edge: { id: 'billing-fraud', source: 'billing', target: 'fraud-check', mode: 'normal' } },
        { type: 'add_edge', edge: { id: 'fraud-refund', source: 'fraud-check', target: 'refund', mode: 'normal' } },
      ],
    });

    expect(result.ok).toBe(true);
    expect(useGraphStore.getState().graph).toEqual(accepted);
    expect(useGraphStore.getState().proposalPreviewGraph).toBeNull();
    useGraphStore.getState().rejectProposal();
  });

  it('keeps reviewed hierarchical geometry and viewport revision stable through approve and freeze', () => {
    const entry = graphLibraryEntries.find((candidate) => candidate.id === 'hierarchical-deep-research')!;
    useGraphStore.getState().loadGraphLibraryEntry(entry);
    const acceptedBefore = structuredClone(useGraphStore.getState().graph);
    const fitRevisionBefore = useGraphStore.getState().fitViewRevision;

    expect(useGraphStore.getState().submitProposal({
      rationale: 'Refine research labels and append a reviewed delivery step.',
      operations: [
        { type: 'update_node', nodeId: 'supervisor-agent', patch: { label: 'Research Supervisor Agent' } },
        { type: 'remove_edge', edgeId: 'brief-complete' },
        {
          type: 'add_node',
          node: {
            id: 'review-report',
            kind: 'step',
            executor: 'human',
            label: 'Review report',
            position: { x: 4780, y: 555 },
          },
        },
        { type: 'add_edge', edge: { id: 'brief-review', source: 'final-report', target: 'review-report', mode: 'normal' } },
        { type: 'add_edge', edge: { id: 'review-complete', source: 'review-report', target: 'research-complete', mode: 'normal' } },
      ],
    }).ok).toBe(true);
    expect(useGraphStore.getState().approveProposal().ok).toBe(true);

    const approved = structuredClone(useGraphStore.getState().graph);
    for (const node of acceptedBefore.nodes) {
      expect(approved.nodes.find((candidate) => candidate.id === node.id)?.position, node.id).toEqual(node.position);
      expect(approved.nodes.find((candidate) => candidate.id === node.id)?.parentId, node.id).toBe(node.parentId);
    }
    expect(approved.nodes.find((node) => node.id === 'review-report')?.position).toEqual({ x: 4780, y: 555 });
    expect(approved.subgraphs).toEqual(acceptedBefore.subgraphs);
    expect(useGraphStore.getState().fitViewRevision).toBe(fitRevisionBefore);

    expect(useGraphStore.getState().freezeGraph().ok).toBe(true);
    expect(useGraphStore.getState().graph.nodes.map(({ id, position, parentId }) => ({ id, position, parentId }))).toEqual(
      approved.nodes.map(({ id, position, parentId }) => ({ id, position, parentId })),
    );
    expect(useGraphStore.getState().graph.subgraphs).toEqual(approved.subgraphs);
    expect(useGraphStore.getState().fitViewRevision).toBe(fitRevisionBefore);
    useGraphStore.getState().unfreezeGraph();
  });

  it('restores deterministic expanded compound geometry after a compact collapse', async () => {
    useGraphStore.getState().loadResearchSupervisorDemo();
    useGraphStore.getState().autoLayout();
    await vi.waitFor(() => {
      expect(useGraphStore.getState().fitViewRevision).toBeGreaterThanOrEqual(2);
    });
    const before = structuredClone(useGraphStore.getState().graph);
    const beforeSubgraph = before.subgraphs[0]!;
    const beforeChildren = before.nodes.filter((node) => node.parentId === beforeSubgraph.id);
    const collapseRevision = useGraphStore.getState().fitViewRevision;

    useGraphStore.getState().setSubgraphCollapsed(beforeSubgraph.id, true);
    await vi.waitFor(() => {
      expect(useGraphStore.getState().fitViewRevision).toBe(collapseRevision + 1);
    });
    expect(useGraphStore.getState().graph.subgraphs[0]!.dimensions).toEqual(beforeSubgraph.dimensions);
    expect(useGraphStore.getState().graph.nodes.filter(
      (node) => node.parentId === beforeSubgraph.id,
    ).map((node) => node.position)).toEqual(beforeChildren.map((node) => node.position));

    const expandRevision = useGraphStore.getState().fitViewRevision;
    useGraphStore.getState().setSubgraphCollapsed(beforeSubgraph.id, false);
    await vi.waitFor(() => {
      expect(useGraphStore.getState().fitViewRevision).toBe(expandRevision + 1);
    });
    expect(useGraphStore.getState().graph.subgraphs[0]!.collapsed).toBe(false);
    expect(useGraphStore.getState().graph.nodes.filter(
      (node) => node.parentId === beforeSubgraph.id,
    ).map((node) => node.position)).toEqual(beforeChildren.map((node) => node.position));
  });

  it('retains a surviving edge selection across undo and redo', () => {
    useGraphStore.getState().loadResearchIntakeRoutingDemo();
    useGraphStore.setState({ past: [], future: [] });
    const selection: WorkspaceSelection = {
      nodeIds: [],
      subgraphIds: [],
      edgeIds: ['clarify-write-brief'],
      primary: { type: 'edge', id: 'clarify-write-brief' },
    };
    useGraphStore.getState().setSelection(selection);

    useGraphStore.getState().updateEdge('clarify-write-brief', { label: '' });
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().selection).toEqual(selection);
    expect(useGraphStore.getState().graph.edges.find(
      (edge) => edge.id === 'clarify-write-brief',
    )?.label).toBe('ready');

    useGraphStore.getState().redo();
    expect(useGraphStore.getState().selection).toEqual(selection);
    expect(useGraphStore.getState().graph.edges.find(
      (edge) => edge.id === 'clarify-write-brief',
    )?.label).toBe('');
  });

  it('prunes selections whose stable IDs are absent from a restored history graph', () => {
    const existingIds = new Set(useGraphStore.getState().graph.nodes.map((node) => node.id));
    useGraphStore.getState().addNode('agent', { x: 900, y: 120 });
    const createdId = useGraphStore.getState().selection.primary?.id;
    expect(createdId).toBeTruthy();
    expect(existingIds.has(createdId!)).toBe(false);

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.nodes.some((node) => node.id === createdId)).toBe(false);
    expect(useGraphStore.getState().selection).toEqual(emptySelection());
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

  it('moves a selected child to its visible parent when collapse hides the child', () => {
    useGraphStore.getState().createSubgraph({ position: { x: 300, y: 80 } });
    const subgraphId = useGraphStore.getState().selection.primary!.id;
    useGraphStore.getState().assignNodesToSubgraph(subgraphId, ['billing']);
    useGraphStore.setState({ past: [], future: [] });
    useGraphStore.getState().setSelection({
      nodeIds: ['billing'],
      subgraphIds: [],
      edgeIds: [],
      primary: { type: 'node', id: 'billing' },
    });
    const expandedGraph = structuredClone(useGraphStore.getState().graph);

    useGraphStore.getState().setSubgraphCollapsed(subgraphId, true);

    expect(useGraphStore.getState().selection).toEqual({
      nodeIds: [],
      subgraphIds: [subgraphId],
      edgeIds: [],
      primary: { type: 'subgraph', id: subgraphId },
    });
    expect(useGraphStore.getState().past).toHaveLength(1);
    expect(useGraphStore.getState().past[0].graph).toEqual(expandedGraph);

    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.subgraphs.find(
      (subgraph) => subgraph.id === subgraphId,
    )?.collapsed).toBe(false);
    expect(useGraphStore.getState().selection.primary).toEqual({
      type: 'subgraph',
      id: subgraphId,
    });

    useGraphStore.getState().redo();
    expect(useGraphStore.getState().graph.subgraphs.find(
      (subgraph) => subgraph.id === subgraphId,
    )?.collapsed).toBe(true);
    expect(useGraphStore.getState().selection.primary).toEqual({
      type: 'subgraph',
      id: subgraphId,
    });
  });

  it('moves a selected internal edge to its visible parent when collapse hides the route', () => {
    useGraphStore.getState().createSubgraph({ position: { x: 300, y: 80 } });
    const subgraphId = useGraphStore.getState().selection.primary!.id;
    useGraphStore.getState().assignNodesToSubgraph(subgraphId, ['classifier', 'billing']);
    useGraphStore.getState().setSelection({
      nodeIds: [],
      subgraphIds: [],
      edgeIds: ['classifier-billing'],
      primary: { type: 'edge', id: 'classifier-billing' },
    });

    useGraphStore.getState().setSubgraphCollapsed(subgraphId, true);

    expect(useGraphStore.getState().selection).toEqual({
      nodeIds: [],
      subgraphIds: [subgraphId],
      edgeIds: [],
      primary: { type: 'subgraph', id: subgraphId },
    });
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

  it('loads a library entry as one undoable edit and clears transient canvas state', async () => {
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
    await vi.waitFor(() => {
      expect(useGraphStore.getState().fitViewRevision).toBe(fitRevision + 1);
    });
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
  it('keeps canonical F3 opaque, readiness, End, and provenance edits through undo/redo and persists no UI-only state', async () => {
    const evidence = {
      source: 'runtime/opaque-inspection.json',
      evidenceClass: 'operator-observed',
      confidence: 'high' as const,
    };
    useGraphStore.getState().updateGraphCapabilities({
      provenance: { evidenceOverlayAvailable: true, externalOrchestrationAvailable: true },
    });
    useGraphStore.getState().updateNode('classifier', {
      provenance: { representation: 'runtime-generated', evidence },
      readiness: { state: 'degraded', detail: 'Inspection endpoint is rate limited.' },
      opaque: {
        factoryLabel: 'ClassifierFactory',
        inputPorts: [{ name: 'request' }],
        outputPorts: [{ name: 'classification' }],
        runtimeInspection: { available: true, evidence },
      },
    });
    useGraphStore.getState().updateNode('end', {
      provenance: { representation: 'derived-semantic', evidence },
      outcome: { kind: 'partial-result', detail: 'Downstream reconciliation remains pending.' },
    });
    const canonicalGraph = structuredClone(useGraphStore.getState().graph);

    useGraphStore.getState().undo();
    useGraphStore.getState().undo();
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.capabilities.provenance.externalOrchestrationAvailable).toBe(false);
    expect(useGraphStore.getState().graph.nodes.find((node) => node.id === 'classifier')).not.toHaveProperty('opaque');

    useGraphStore.getState().redo();
    useGraphStore.getState().redo();
    useGraphStore.getState().redo();
    expect(useGraphStore.getState().graph).toEqual(canonicalGraph);

    useGraphStore.setState({
      runtimeProjectionFixture: {
        graphId: canonicalGraph.id,
        graphUpdatedAt: canonicalGraph.updatedAt,
        instances: [],
      },
      clipboardNodeIds: ['classifier'],
      selection: {
        nodeIds: ['classifier'],
        subgraphIds: [],
        edgeIds: [],
        primary: { type: 'node', id: 'classifier' },
      },
    });
    const serialized = JSON.parse(persisted.get('graphcontract-workspace-v1')!);
    expect(serialized.state).toEqual({ graph: canonicalGraph, proposal: null, reviewRequest: null });
    expect(serialized.state).not.toHaveProperty('selection');
    expect(serialized.state).not.toHaveProperty('runtimeProjectionFixture');
    expect(serialized.state).not.toHaveProperty('clipboardNodeIds');

    await useGraphStore.persist.rehydrate();
    expect(useGraphStore.getState().graph).toEqual(canonicalGraph);
  });

  it('persists the reviewed candidate with human feedback and consumes both only for a valid pending replacement', async () => {
    const accepted = structuredClone(useGraphStore.getState().graph);
    expect(useGraphStore.getState().submitProposal({
      rationale: 'Rename the billing specialist.',
      expectedGraphUpdatedAt: accepted.updatedAt,
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { label: 'Billing Resolution Agent' } },
      ],
    }).ok).toBe(true);
    const pendingId = useGraphStore.getState().proposal!.id;
    expect(useGraphStore.getState().requestProposalChanges(
      'Keep the label and document the escalation route.',
    ).ok).toBe(true);
    const requested = structuredClone(useGraphStore.getState().reviewRequest);
    const reviewedCandidate = structuredClone(useGraphStore.getState().proposal);

    expect(useGraphStore.getState().graph).toEqual(accepted);
    expect(requested).toMatchObject({
      status: 'changes_requested',
      proposalId: pendingId,
      reviewedGraphUpdatedAt: accepted.updatedAt,
    });
    const serialized = JSON.parse(persisted.get('graphcontract-workspace-v1')!);
    expect(serialized.state).toEqual({
      graph: accepted,
      proposal: reviewedCandidate,
      reviewRequest: requested,
    });

    await useGraphStore.persist.rehydrate();
    expect(useGraphStore.getState().reviewRequest).toEqual(requested);
    expect(useGraphStore.getState().proposal).toEqual(reviewedCandidate);
    expect(useGraphStore.getState().graph).toEqual(accepted);

    const stale = useGraphStore.getState().submitProposal({
      rationale: 'Use a stale accepted revision.',
      expectedGraphUpdatedAt: '2020-01-01T00:00:00.000Z',
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { description: 'Escalates complex cases.' } },
      ],
    });
    expect(stale).toMatchObject({ ok: false, error: { code: 'PROPOSAL_STALE' } });
    expect(useGraphStore.getState().proposal).toEqual(reviewedCandidate);
    expect(useGraphStore.getState().reviewRequest).toEqual(requested);

    const invalid = useGraphStore.getState().submitProposal({
      rationale: 'Reference a missing node.',
      expectedGraphUpdatedAt: accepted.updatedAt,
      operations: [{ type: 'update_node', nodeId: 'missing', patch: { label: 'Missing' } }],
    });
    expect(invalid).toMatchObject({ ok: false, error: { code: 'PROPOSAL_INVALID' } });
    expect(useGraphStore.getState().proposal).toEqual(reviewedCandidate);
    expect(useGraphStore.getState().reviewRequest).toEqual(requested);

    const revised = useGraphStore.getState().submitProposal({
      rationale: 'Document the escalation route.',
      expectedGraphUpdatedAt: accepted.updatedAt,
      operations: [
        { type: 'update_node', nodeId: 'billing', patch: { description: 'Escalates complex cases.' } },
      ],
    });
    expect(revised).toMatchObject({ ok: true, proposal: { status: 'pending' } });
    expect(useGraphStore.getState().proposal?.id).not.toBe(reviewedCandidate?.id);
    expect(useGraphStore.getState().reviewRequest).toBeNull();
    expect(useGraphStore.getState().graph).toEqual(accepted);
    useGraphStore.getState().rejectProposal();
  });

  it.each([7, 8])('rehydrates v%s frozen state from the graph instead of trusting saved scenarios', async (version) => {
    const frozenGraph = { ...structuredClone(sampleGraph), status: 'frozen' as const };
    const staleScenarios = enumerateScenarios(frozenGraph).map((scenario) => ({
      ...scenario,
      expectedTerminalNode: 'stale-terminal',
    }));
    persisted.set(
      'graphcontract-workspace-v1',
      JSON.stringify({
        state: { graph: frozenGraph, proposal: null, scenarios: staleScenarios },
        version,
      }),
    );

    await useGraphStore.persist.rehydrate();

    expect(useGraphStore.getState().graph).toEqual(normalizeWorkflowGraph(frozenGraph));
    expect(useGraphStore.getState().scenarios).toEqual(enumerateScenarios(frozenGraph));
    expect(useGraphStore.getState().scenarios).not.toEqual(staleScenarios);
    useGraphStore.getState().unfreezeGraph();
  });

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
      'Resolve the agent proposal before editing the accepted graph.',
    );
  });
});
