'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { migrateWorkspaceV2 } from '@/src/adapters/persistence/migrate-workspace';
import {
  createWorkspaceService,
  FreezeResult,
  ProposalResult,
  WorkspaceCore,
  WorkspaceTransition,
} from '@/src/application/workspace';
import { GraphEdge, GraphNode, NodeKind } from '@/src/domain';

export type WorkspaceSelection = {
  nodeIds: string[];
  edgeIds: string[];
  primary: { type: 'node' | 'edge'; id: string } | null;
};

type WorkspaceStore = WorkspaceCore & {
  selection: WorkspaceSelection;
  clipboardNodeIds: string[];
  past: WorkspaceCore[];
  future: WorkspaceCore[];
  notice: string | null;
  fitViewRevision: number;
  addNode: (kind: NodeKind, position?: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, patch: Partial<Omit<GraphNode, 'id'>>) => void;
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
  clearNotice: () => void;
};

const emptySelection = (): WorkspaceSelection => ({ nodeIds: [], edgeIds: [], primary: null });
const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);
const sameSelection = (left: WorkspaceSelection, right: WorkspaceSelection) =>
  sameIds(left.nodeIds, right.nodeIds) &&
  sameIds(left.edgeIds, right.edgeIds) &&
  left.primary?.type === right.primary?.type &&
  left.primary?.id === right.primary?.id;
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
              ? { nodeIds: [nodeId], edgeIds: [], primary: { type: 'node', id: nodeId } }
              : get().selection,
          });
        },

        moveNode: (id, position) => commit(workspace.moveNode(currentCore(), id, position)),
        updateNode: (id, patch) => commit(workspace.updateNode(currentCore(), id, patch)),
        removeNode: (id) =>
          commit(workspace.removeNode(currentCore(), id), { selection: emptySelection() }),

        addEdge: (source, target) => {
          const transition = workspace.addEdge(currentCore(), source, target);
          const edgeId = transition.result?.edgeId;
          commit(transition, {
            selection: edgeId
              ? { nodeIds: [], edgeIds: [edgeId], primary: { type: 'edge', id: edgeId } }
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
          if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) return;
          commit(
            workspace.deleteElements(currentCore(), selection.nodeIds, selection.edgeIds),
            { selection: emptySelection() },
          );
        },

        copySelection: () => set({ clipboardNodeIds: [...get().selection.nodeIds] }),

        pasteSelection: () => {
          const transition = workspace.duplicateNodes(currentCore(), get().clipboardNodeIds);
          const nodeIds = transition.result?.nodeIds ?? [];
          commit(transition, {
            selection: nodeIds.length
              ? {
                  nodeIds,
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

        clearNotice: () => set({ notice: null }),
      };
    },
    {
      name: 'graphcontract-workspace-v1',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persistedState) =>
        migrateWorkspaceV2(persistedState, workspace.createInitial) as WorkspaceStore,
      partialize: (state) => ({
        graph: state.graph,
        proposal: state.proposal,
        scenarios: state.scenarios,
      }),
    },
  ),
);
