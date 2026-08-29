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
  protectedEdgeIds: [],
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

  it('does not delete canonical edges selected through a collapsed proxy and loads the separate demo explicitly', () => {
    const initial = useGraphStore.getState();
    const originalEdges = structuredClone(initial.graph.edges);
    useGraphStore.getState().setSelection({
      nodeIds: [],
      subgraphIds: [],
      edgeIds: ['billing-refund'],
      protectedEdgeIds: ['billing-refund'],
      primary: { type: 'edge', id: 'billing-refund' },
    });
    useGraphStore.getState().deleteSelection();
    expect(useGraphStore.getState().graph.edges).toEqual(originalEdges);

    useGraphStore.getState().loadResearchSupervisorDemo();
    expect(useGraphStore.getState().graph.id).toBe('research-supervisor-demo');
    expect(useGraphStore.getState().selection).toEqual(emptySelection());
  });
});
