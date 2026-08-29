'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { migrateWorkspaceV3 } from '@/src/adapters/persistence/migrate-workspace';
import {
  createWorkspaceService,
  FreezeResult,
  ProposalResult,
  WorkspaceCore,
  WorkspaceTransition,
} from '@/src/application/workspace';
import {
  GraphEdge,
  GraphNode,
  GraphPosition,
  GraphSubgraph,
  NodeKind,
  WorkflowGraph,
} from '@/src/domain';

export type WorkspaceSelection = {
  nodeIds: string[];
  subgraphIds: string[];
  edgeIds: string[];
  primary: { type: 'node' | 'edge' | 'subgraph'; id: string } | null;
};

type WorkspaceStore = WorkspaceCore & {
  selection: WorkspaceSelection;
  clipboardNodeIds: string[];
  past: WorkspaceCore[];
  future: WorkspaceCore[];
  notice: string | null;
  fitViewRevision: number;
  addNode: (kind: NodeKind, position?: { x: number; y: number }) => void;
  createSubgraph: (input: {
    label?: string;
    position: GraphPosition;
    dimensions?: GraphSubgraph['dimensions'];
    collapsed?: boolean;
  }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  moveNodes: (positions: Record<string, { x: number; y: number }>) => void;
  moveSubgraph: (id: string, position: GraphPosition) => void;
  moveCanvasElements: (positions: Record<string, GraphPosition>) => void;
  updateNode: (id: string, patch: Partial<Omit<GraphNode, 'id'>>) => void;
  updateSubgraph: (id: string, patch: Partial<Omit<GraphSubgraph, 'id'>>) => void;
  setSubgraphCollapsed: (id: string, collapsed: boolean) => void;
  assignNodesToSubgraph: (subgraphId: string, nodeIds: string[]) => void;
  removeNodeFromSubgraph: (nodeId: string) => void;
  dissolveSubgraph: (subgraphId: string) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string) => void;
  updateEdge: (id: string, patch: Partial<Omit<GraphEdge, 'id'>>) => void;
  removeEdge: (id: string) => void;
  setSelection: (selection: WorkspaceSelection) => void;
  clearSelection: () => void;
  deleteSelection: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
  duplicateSelection: () => void;
  undo: () => void;
  redo: () => void;
  submitProposal: (input: unknown) => ProposalResult;
  approveProposal: () => ProposalResult;
  rejectProposal: () => void;
  freezeGraph: () => FreezeResult;
  unfreezeGraph: () => void;
  resetGraph: () => void;
  loadResearchSupervisorDemo: () => void;
  clearNotice: () => void;
};

const emptySelection = (): WorkspaceSelection => ({
  nodeIds: [],
  subgraphIds: [],
  edgeIds: [],
  primary: null,
});
const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));
const sameSelection = (left: WorkspaceSelection, right: WorkspaceSelection) =>
  sameIds(left.nodeIds, right.nodeIds) &&
  sameIds(left.subgraphIds, right.subgraphIds) &&
  sameIds(left.edgeIds, right.edgeIds) &&
  left.primary?.type === right.primary?.type &&
  left.primary?.id === right.primary?.id;

/** Returns true only for a boundary edge currently rendered as a collapsed
 * subgraph proxy. Selection is intentionally not consulted, so a graph edit
 * between selection and Delete cannot make a proxy edge deletable. */
export function isDomainEdgeProjectedAsCollapsedProxy(
  graph: WorkflowGraph,
  edgeId: string,
): boolean {
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return false;
  const nodeParents = new Map(graph.nodes.map((node) => [node.id, node.parentId]));
  const collapsedSubgraphIds = new Set(
    graph.subgraphs.filter((subgraph) => subgraph.collapsed).map((subgraph) => subgraph.id),
  );
  const sourceParentId = nodeParents.get(edge.source);
  const targetParentId = nodeParents.get(edge.target);
  const source = sourceParentId && collapsedSubgraphIds.has(sourceParentId)
    ? sourceParentId
    : edge.source;
  const target = targetParentId && collapsedSubgraphIds.has(targetParentId)
    ? targetParentId
    : edge.target;
  const hiddenInternalEdge = source === target && source !== edge.source;
  return !hiddenInternalEdge && (source !== edge.source || target !== edge.target);
}
const coreOf = (state: WorkspaceCore): WorkspaceCore => ({
  graph: structuredClone(state.graph),
  proposal: structuredClone(state.proposal),
  scenarios: structuredClone(state.scenarios),
});
const makeId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
const workspace = createWorkspaceService({ now: () => new Date().toISOString(), makeId });

export const useGraphStore = create<WorkspaceStore>()(
  persist(
    (set, get) => {
      const commit = <Result,>(
        transition: WorkspaceTransition<Result>,
        options: { history?: boolean; selection?: WorkspaceSelection } = {},
      ) => {
        set((current) => ({
          ...transition.state,
          selection: options.selection ?? current.selection,
          notice: transition.notice ?? current.notice,
          past:
            transition.changed && options.history !== false
              ? [...current.past.slice(-49), coreOf(current)]
              : current.past,
          future:
            transition.changed && options.history !== false ? [] : current.future,
        }));
      };

      const currentCore = (): WorkspaceCore => coreOf(get());
      const initial = workspace.createInitial();

      return {
        ...initial,
        selection: emptySelection(),
        clipboardNodeIds: [],
        past: [],
        future: [],
        notice: null,
        fitViewRevision: 0,

        addNode: (kind, position = { x: 360, y: 180 }) => {
          const transition = workspace.addNode(currentCore(), kind, position);
          const nodeId = transition.result?.nodeId;
          commit(transition, {
            selection: nodeId
              ? {
                  nodeIds: [nodeId],
                  subgraphIds: [],
                  edgeIds: [],
                  primary: { type: 'node', id: nodeId },
                }
              : get().selection,
          });
        },

        createSubgraph: (input) => {
          const transition = workspace.createSubgraph(currentCore(), input);
          const subgraphId = transition.result?.subgraphId;
          commit(transition, {
            selection: subgraphId
              ? {
                  nodeIds: [],
                  subgraphIds: [subgraphId],
                  edgeIds: [],
                  primary: { type: 'subgraph', id: subgraphId },
                }
              : get().selection,
          });
        },

        moveNode: (id, position) => commit(workspace.moveNode(currentCore(), id, position)),
        moveNodes: (positions) => commit(workspace.moveNodes(currentCore(), positions)),
        moveSubgraph: (id, position) =>
          commit(workspace.moveSubgraph(currentCore(), id, position)),
        moveCanvasElements: (positions) => {
          const initialState = currentCore();
          const subgraphIds = new Set(initialState.graph.subgraphs.map((subgraph) => subgraph.id));
          const nodePositions = Object.fromEntries(
            Object.entries(positions).filter(([id]) => !subgraphIds.has(id)),
          );
          let state = initialState;
          let changed = false;
          let notice: string | undefined;

          if (Object.keys(nodePositions).length > 0) {
            const transition = workspace.moveNodes(state, nodePositions);
            state = transition.state;
            changed ||= transition.changed;
            notice = transition.notice ?? notice;
          }
          for (const [subgraphId, position] of Object.entries(positions)) {
            if (!subgraphIds.has(subgraphId)) continue;
            const transition = workspace.moveSubgraph(state, subgraphId, position);
            state = transition.state;
            changed ||= transition.changed;
            notice = transition.notice ?? notice;
          }

          if (changed) commit({ state, changed, notice });
        },
        updateNode: (id, patch) => commit(workspace.updateNode(currentCore(), id, patch)),
        updateSubgraph: (id, patch) =>
          commit(workspace.updateSubgraph(currentCore(), id, patch)),
        setSubgraphCollapsed: (id, collapsed) =>
          commit(workspace.setSubgraphCollapsed(currentCore(), id, collapsed)),
        assignNodesToSubgraph: (subgraphId, nodeIds) =>
          commit(workspace.assignNodesToSubgraph(currentCore(), subgraphId, nodeIds)),
        removeNodeFromSubgraph: (nodeId) =>
          commit(workspace.removeNodeFromSubgraph(currentCore(), nodeId)),
        dissolveSubgraph: (subgraphId) =>
          commit(workspace.dissolveSubgraph(currentCore(), subgraphId), {
            selection: emptySelection(),
          }),
        removeNode: (id) =>
          commit(workspace.removeNode(currentCore(), id), { selection: emptySelection() }),

        addEdge: (source, target) => {
          const transition = workspace.addEdge(currentCore(), source, target);
          const edgeId = transition.result?.edgeId;
          commit(transition, {
            selection: edgeId
              ? {
                  nodeIds: [],
                  subgraphIds: [],
                  edgeIds: [edgeId],
                  primary: { type: 'edge', id: edgeId },
                }
              : get().selection,
          });
        },

        updateEdge: (id, patch) => commit(workspace.updateEdge(currentCore(), id, patch)),
        removeEdge: (id) =>
          commit(workspace.removeEdge(currentCore(), id), { selection: emptySelection() }),

        setSelection: (selection) =>
          set((state) => (sameSelection(state.selection, selection) ? state : { selection })),
        clearSelection: () => set({ selection: emptySelection() }),

        deleteSelection: () => {
          const { selection } = get();
          const deletableEdgeIds = selection.edgeIds.filter(
            (edgeId) => !isDomainEdgeProjectedAsCollapsedProxy(get().graph, edgeId),
          );
          if (
            selection.nodeIds.length === 0 &&
            selection.subgraphIds.length === 0 &&
            deletableEdgeIds.length === 0
          ) {
            return;
          }

          const initialState = currentCore();
          const selectedSubgraphIds = new Set(selection.subgraphIds);
          const childIdsOfDeletedSubgraphs = new Set(
            initialState.graph.nodes
              .filter((node) => node.parentId && selectedSubgraphIds.has(node.parentId))
              .map((node) => node.id),
          );
          let state = initialState;
          let changed = false;
          let notice: string | undefined;
          for (const subgraphId of selectedSubgraphIds) {
            const transition = workspace.dissolveSubgraph(state, subgraphId);
            state = transition.state;
            changed ||= transition.changed;
            notice = transition.notice ?? notice;
          }
          const transition = workspace.deleteElements(
            state,
            selection.nodeIds.filter((nodeId) => !childIdsOfDeletedSubgraphs.has(nodeId)),
            deletableEdgeIds,
          );
          state = transition.state;
          changed ||= transition.changed;
          notice = transition.notice ?? notice;
          if (changed) {
            commit({ state, changed, notice }, { selection: emptySelection() });
          }
        },

        copySelection: () => set({ clipboardNodeIds: [...get().selection.nodeIds] }),

        pasteSelection: () => {
          const transition = workspace.duplicateNodes(currentCore(), get().clipboardNodeIds);
          const nodeIds = transition.result?.nodeIds ?? [];
          commit(transition, {
            selection: nodeIds.length
              ? {
                  nodeIds,
                  subgraphIds: [],
                  edgeIds: [],
                  primary: { type: 'node', id: nodeIds[nodeIds.length - 1] },
                }
              : get().selection,
          });
        },

        duplicateSelection: () => {
          const transition = workspace.duplicateNodes(currentCore(), get().selection.nodeIds);
          const nodeIds = transition.result?.nodeIds ?? [];
          commit(transition, {
            selection: nodeIds.length
              ? {
                  nodeIds,
                  subgraphIds: [],
                  edgeIds: [],
                  primary: { type: 'node', id: nodeIds[nodeIds.length - 1] },
                }
              : get().selection,
          });
        },

        undo: () => {
          const state = get();
          if (state.past.length === 0 || state.graph.status === 'frozen' || state.proposal) return;
          const previous = state.past[state.past.length - 1];
          set({
            ...coreOf(previous),
            past: state.past.slice(0, -1),
            future: [coreOf(state), ...state.future.slice(0, 49)],
            selection: emptySelection(),
            notice: 'Undid the last graph edit.',
          });
        },

        redo: () => {
          const state = get();
          if (state.future.length === 0 || state.graph.status === 'frozen' || state.proposal) return;
          const next = state.future[0];
          set({
            ...coreOf(next),
            past: [...state.past.slice(-49), coreOf(state)],
            future: state.future.slice(1),
            selection: emptySelection(),
            notice: 'Redid the graph edit.',
          });
        },

        submitProposal: (input) => {
          const transition = workspace.submitProposal(currentCore(), input);
          commit(transition, { history: false });
          return transition.result!;
        },

        approveProposal: () => {
          const transition = workspace.approveProposal(currentCore());
          commit(transition, { history: false, selection: emptySelection() });
          if (transition.result?.ok) {
            set((state) => ({ fitViewRevision: state.fitViewRevision + 1 }));
          }
          return transition.result!;
        },

        rejectProposal: () =>
          commit(workspace.rejectProposal(currentCore()), { history: false }),

        freezeGraph: () => {
          const transition = workspace.freezeGraph(currentCore());
          commit(transition, { history: false, selection: emptySelection() });
          return transition.result!;
        },

        unfreezeGraph: () =>
          commit(workspace.unfreezeGraph(currentCore()), {
            history: false,
            selection: emptySelection(),
          }),

        resetGraph: () => {
          commit(workspace.resetGraph(), { selection: emptySelection() });
          set((state) => ({ clipboardNodeIds: [], fitViewRevision: state.fitViewRevision + 1 }));
        },

        loadResearchSupervisorDemo: () => {
          commit(workspace.loadResearchSupervisorDemo(currentCore()), { selection: emptySelection() });
          set((state) => ({
            clipboardNodeIds: [],
            fitViewRevision: state.fitViewRevision + 1,
          }));
        },

        clearNotice: () => set({ notice: null }),
      };
    },
    {
      name: 'graphcontract-workspace-v1',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persistedState) =>
        migrateWorkspaceV3(persistedState, workspace.createInitial) as WorkspaceStore,
      partialize: (state) => ({
        graph: state.graph,
        proposal: state.proposal,
        scenarios: state.scenarios,
      }),
    },
  ),
);
