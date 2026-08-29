import { beforeEach, describe, expect, it, vi } from 'vitest';

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
