'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { migrateWorkspaceV7 } from '@/src/adapters/persistence/migrate-workspace';
import {
  createWorkspaceService,
  FreezeResult,
  NodeCreationPreset,
  ProposalResult,
  RequestChangesResult,
  WorkspaceCore,
  WorkspaceTransition,
  withScheduledWorkflowLayout,
} from '@/src/application/workspace';
import type { ProposalReviewSubmission } from '@/src/application/proposal-review';
import {
  GraphEdgePatch,
  GraphCapabilities,
  GraphCapabilityOverrides,
  GraphNodePatch,
  GraphPosition,
  GraphSubgraph,
  RuntimeProjectionFixture,
  RetryPolicy,
  StepStoreAccess,
  WorkflowGraph,
} from '@/src/domain';
import { runtimeFixtureForLoadedDynamicParallelismDemo } from '@/src/application/package-three-demo';
import type { GraphLibraryEntry } from '@/src/application/graph-library-contract';
import { layoutWorkflowGraph } from '@/src/application/layout-workflow';

export type WorkspaceSelection = {
  nodeIds: string[];
  subgraphIds: string[];
  edgeIds: string[];
  primary: { type: 'node' | 'edge' | 'subgraph'; id: string } | null;
};

type WorkspaceStore = WorkspaceCore & {
  /** Ephemeral evidence: deliberately absent from core history and persistence. */
  runtimeProjectionFixture: RuntimeProjectionFixture | null;
  /** ELK geometry for the current proposal candidate; never accepted or persisted. */
  proposalPreviewGraph: WorkflowGraph | null;
  /** Ephemeral accepted-graph layout lifecycle; never persisted as contract data. */
  layoutPending: boolean;
  selection: WorkspaceSelection;
  clipboardNodeIds: string[];
  past: WorkspaceCore[];
  future: WorkspaceCore[];
  notice: string | null;
  fitViewRevision: number;
  autoLayout: () => void;
  addNode: (preset: NodeCreationPreset, position?: { x: number; y: number }) => void;
  createSubgraph: (input: {
    label?: string;
    position: GraphPosition;
    dimensions?: GraphSubgraph['dimensions'];
    collapsed?: boolean;
    parentId?: string;
  }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  moveNodes: (positions: Record<string, { x: number; y: number }>) => void;
  moveSubgraph: (id: string, position: GraphPosition) => void;
  moveDynamicWorkerGroup: (edgeId: string, position: GraphPosition) => void;
  resizeDynamicWorkerGroup: (edgeId: string, dimensions: GraphSubgraph['dimensions']) => void;
  moveCanvasElements: (positions: Record<string, GraphPosition>) => void;
  updateNode: (id: string, patch: GraphNodePatch) => void;
  updateGraphCapabilities: (patch: Partial<GraphCapabilities>) => void;
  setSubgraphCapabilityOverride: (
    subgraphId: string,
    capability: keyof GraphCapabilityOverrides,
    value: GraphCapabilityOverrides[keyof GraphCapabilityOverrides] | null,
  ) => void;
  updateStepStoreAccess: (id: string, storeAccess: StepStoreAccess | null) => void;
  updateStepRetry: (id: string, retry: RetryPolicy | null) => void;
  updateSubgraph: (id: string, patch: Partial<Omit<GraphSubgraph, 'id'>>) => void;
  setSubgraphCollapsed: (id: string, collapsed: boolean) => void;
  assignNodesToSubgraph: (subgraphId: string, nodeIds: string[]) => void;
  removeNodeFromSubgraph: (nodeId: string) => void;
  dissolveSubgraph: (subgraphId: string) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string) => void;
  updateEdge: (id: string, patch: GraphEdgePatch) => void;
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
  requestProposalChanges: (submission: string | ProposalReviewSubmission) => RequestChangesResult;
  rejectProposal: () => void;
  freezeGraph: () => FreezeResult;
  unfreezeGraph: () => void;
  resetGraph: () => void;
  loadGraphLibraryEntry: (entry: Pick<GraphLibraryEntry, 'title' | 'graph' | 'layout'>) => boolean;
  loadResearchSupervisorDemo: () => void;
  loadResearchIntakeRoutingDemo: () => void;
  loadHumanControlHitlDemo: () => void;
  loadDynamicParallelismDemo: () => void;
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

/** Keep history navigation and React Flow on one selection authority. Undo and
 * redo may replace the graph, so retain selections whose stable IDs still
 * exist and discard only elements that are absent from the restored graph. */
export function selectionForGraph(
  graph: WorkflowGraph,
  selection: WorkspaceSelection,
): WorkspaceSelection {
  const nodeIdsInGraph = new Set(graph.nodes.map((node) => node.id));
  const subgraphIdsInGraph = new Set(graph.subgraphs.map((subgraph) => subgraph.id));
  const edgeIdsInGraph = new Set(graph.edges.map((edge) => edge.id));
  const nodeIds = selection.nodeIds.filter((id) => nodeIdsInGraph.has(id));
  const subgraphIds = selection.subgraphIds.filter((id) => subgraphIdsInGraph.has(id));
  const edgeIds = selection.edgeIds.filter((id) => edgeIdsInGraph.has(id));
  const primaryStillExists = selection.primary
    ? selection.primary.type === 'node'
      ? nodeIds.includes(selection.primary.id)
      : selection.primary.type === 'subgraph'
        ? subgraphIds.includes(selection.primary.id)
        : edgeIds.includes(selection.primary.id)
    : false;
  const primary = primaryStillExists
    ? selection.primary
    : nodeIds.length > 0
      ? { type: 'node' as const, id: nodeIds[nodeIds.length - 1] }
      : subgraphIds.length > 0
        ? { type: 'subgraph' as const, id: subgraphIds[subgraphIds.length - 1] }
        : edgeIds.length > 0
          ? { type: 'edge' as const, id: edgeIds[edgeIds.length - 1] }
          : null;
  const reconciled = { nodeIds, subgraphIds, edgeIds, primary };
  return sameSelection(selection, reconciled) ? selection : reconciled;
}

function selectionForCollapsedSubgraph(
  graph: WorkflowGraph,
  selection: WorkspaceSelection,
  subgraphId: string,
): WorkspaceSelection {
  const memberNodeIds = new Set(
    graph.nodes
      .filter((node) => node.parentId === subgraphId)
      .map((node) => node.id),
  );
  const hiddenSelectedNodeIds = new Set(
    selection.nodeIds.filter((id) => memberNodeIds.has(id)),
  );
  const hiddenSelectedEdgeIds = new Set(
    graph.edges
      .filter(
        (edge) =>
          selection.edgeIds.includes(edge.id) &&
          memberNodeIds.has(edge.source) &&
          memberNodeIds.has(edge.target),
      )
      .map((edge) => edge.id),
  );
  if (hiddenSelectedNodeIds.size === 0 && hiddenSelectedEdgeIds.size === 0) return selection;

  const nodeIds = selection.nodeIds.filter((id) => !hiddenSelectedNodeIds.has(id));
  const edgeIds = selection.edgeIds.filter((id) => !hiddenSelectedEdgeIds.has(id));
  const subgraphIds = selection.subgraphIds.includes(subgraphId)
    ? selection.subgraphIds
    : [...selection.subgraphIds, subgraphId];
  const primary =
    selection.primary &&
    ((selection.primary.type === 'node' && hiddenSelectedNodeIds.has(selection.primary.id)) ||
      (selection.primary.type === 'edge' && hiddenSelectedEdgeIds.has(selection.primary.id)))
      ? { type: 'subgraph' as const, id: subgraphId }
      : selection.primary;
  const reconciled = { nodeIds, subgraphIds, edgeIds, primary };
  return sameSelection(selection, reconciled) ? selection : reconciled;
}

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
  reviewRequest: structuredClone(state.reviewRequest ?? null),
  scenarios: structuredClone(state.scenarios),
});
const makeId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
const workspace = createWorkspaceService({ now: () => new Date().toISOString(), makeId });

export const useGraphStore = create<WorkspaceStore>()(
  persist(
    (set, get) => {
      let graphMutationRevision = 0;
      let layoutRequestRevision = 0;
      let proposalLayoutRequestRevision = 0;
      const unresolvedHistoryLayouts = new Set<string>();
      const graphSignature = (graph: WorkflowGraph) => JSON.stringify(graph);
      const commit = <Result,>(
        transition: WorkspaceTransition<Result>,
        options: { history?: boolean; selection?: WorkspaceSelection } = {},
      ) => {
        const acceptedGraphChanged = graphSignature(get().graph) !== graphSignature(transition.state.graph);
        if (acceptedGraphChanged) graphMutationRevision += 1;
        set((current) => {
          const proposalChanged = current.proposal?.id !== transition.state.proposal?.id;
          if (transition.changed && options.history !== false && current.layoutPending) {
            unresolvedHistoryLayouts.add(graphSignature(current.graph));
          }
          return {
            ...transition.state,
            selection: options.selection ?? current.selection,
            notice: transition.notice ?? current.notice,
            proposalPreviewGraph:
              proposalChanged || acceptedGraphChanged || !transition.state.proposal
                ? null
                : current.proposalPreviewGraph,
            layoutPending: transition.layoutPromise
              ? true
              : acceptedGraphChanged
                ? false
                : current.layoutPending,
            past:
              transition.changed && options.history !== false
                ? [...current.past.slice(-49), coreOf(current)]
                : current.past,
            future:
              transition.changed && options.history !== false ? [] : current.future,
          };
        });
      };

      const currentCore = (): WorkspaceCore => coreOf(get());
      const applyAsyncLayout = (
        sourceGraph: WorkflowGraph,
        layoutPromise: Promise<WorkflowGraph>,
      ) => {
        const sourceSignature = graphSignature(sourceGraph);
        const sourceRevision = graphMutationRevision;
        const requestRevision = ++layoutRequestRevision;
        void layoutPromise.then((graph) => {
          // Never let a completed worker result overwrite an intervening edit.
          if (
            requestRevision !== layoutRequestRevision ||
            sourceRevision !== graphMutationRevision ||
            graphSignature(get().graph) !== sourceSignature
          ) return;
          commit({
            state: { ...currentCore(), graph, scenarios: [] },
            changed: false,
            notice: 'Workflow arranged with deterministic left-to-right layout.',
            layoutApplied: true,
          }, { history: false, selection: selectionForGraph(graph, get().selection) });
          set({ layoutPending: false });
          set((state) => ({ fitViewRevision: state.fitViewRevision + 1 }));
        }).catch(() => {
          if (requestRevision === layoutRequestRevision && graphSignature(get().graph) === sourceSignature) {
            set({
              layoutPending: false,
              notice: 'Workflow arrangement could not complete.',
            });
          }
        });
      };
      const commitWithLayout = <Result,>(
        transition: WorkspaceTransition<Result>,
        options: { history?: boolean; selection?: WorkspaceSelection } = {},
      ) => {
        const selection = options.selection ?? get().selection;
        commit(transition, { ...options, selection });
        if (transition.layoutPromise) {
          applyAsyncLayout(transition.state.graph, transition.layoutPromise);
        }
      };
      const applyAsyncProposalLayout = (
        proposalId: string,
        acceptedGraph: WorkflowGraph,
        layoutPromise: Promise<WorkflowGraph>,
      ) => {
        const acceptedUpdatedAt = acceptedGraph.updatedAt;
        const acceptedGraphId = acceptedGraph.id;
        const requestRevision = ++proposalLayoutRequestRevision;
        void layoutPromise.then((candidate) => {
          const current = get();
          if (
            requestRevision !== proposalLayoutRequestRevision ||
            current.proposal?.id !== proposalId ||
            current.graph.id !== acceptedGraphId ||
            current.graph.updatedAt !== acceptedUpdatedAt
          ) return;
          set({ proposalPreviewGraph: candidate });
        }).catch(() => {
          // Proposal review remains usable with its authored positions if ELK
          // cannot derive a candidate layout.
        });
      };
      const initial = workspace.createInitial();

      return {
        ...initial,
        runtimeProjectionFixture: null,
        proposalPreviewGraph: null,
        layoutPending: false,
        selection: emptySelection(),
        clipboardNodeIds: [],
        past: [],
        future: [],
        notice: null,
        fitViewRevision: 0,

        autoLayout: () => {
          const transition = workspace.autoLayout(currentCore());
          const selection = transition.changed ? emptySelection() : get().selection;
          commitWithLayout(transition, { selection });
        },

        addNode: (preset, position = { x: 360, y: 180 }) => {
          const transition = workspace.addNode(currentCore(), preset, position);
          const nodeId = transition.result?.nodeId;
          commitWithLayout(transition, {
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
          commitWithLayout(transition, {
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
        moveDynamicWorkerGroup: (edgeId, position) =>
          commit(workspace.moveDynamicWorkerGroup(currentCore(), edgeId, position)),
        resizeDynamicWorkerGroup: (edgeId, dimensions) =>
          commit(workspace.resizeDynamicWorkerGroup(currentCore(), edgeId, dimensions)),
        moveCanvasElements: (positions) =>
          commitWithLayout(workspace.moveCanvasElements(currentCore(), positions)),
        updateNode: (id, patch) => commit(workspace.updateNode(currentCore(), id, patch)),
        updateGraphCapabilities: (patch) =>
          commit(workspace.updateGraphCapabilities(currentCore(), patch)),
        setSubgraphCapabilityOverride: (subgraphId, capability, value) =>
          commit(workspace.setSubgraphCapabilityOverride(currentCore(), subgraphId, capability, value)),
        updateStepStoreAccess: (id, storeAccess) =>
          commit(workspace.updateStepStoreAccess(currentCore(), id, storeAccess)),
        updateStepRetry: (id, retry) =>
          commit(workspace.updateStepRetry(currentCore(), id, retry)),
        updateSubgraph: (id, patch) =>
          commit(workspace.updateSubgraph(currentCore(), id, patch)),
        setSubgraphCollapsed: (id, collapsed) => {
          const transition = workspace.setSubgraphCollapsed(currentCore(), id, collapsed);
          const selection = get().selection;
          commitWithLayout(transition, {
            selection:
              transition.changed && collapsed
                ? selectionForCollapsedSubgraph(transition.state.graph, selection, id)
                : selection,
          });
        },
        assignNodesToSubgraph: (subgraphId, nodeIds) =>
          commitWithLayout(workspace.assignNodesToSubgraph(currentCore(), subgraphId, nodeIds)),
        removeNodeFromSubgraph: (nodeId) =>
          commitWithLayout(workspace.removeNodeFromSubgraph(currentCore(), nodeId)),
        dissolveSubgraph: (subgraphId) =>
          commitWithLayout(workspace.dissolveSubgraph(currentCore(), subgraphId), {
            selection: emptySelection(),
          }),
        removeNode: (id) =>
          commitWithLayout(workspace.removeNode(currentCore(), id), { selection: emptySelection() }),

        addEdge: (source, target) => {
          const transition = workspace.addEdge(currentCore(), source, target);
          const edgeId = transition.result?.edgeId;
          commitWithLayout(transition, {
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

        updateEdge: (id, patch) => commitWithLayout(workspace.updateEdge(currentCore(), id, patch)),
        removeEdge: (id) =>
          commitWithLayout(workspace.removeEdge(currentCore(), id), { selection: emptySelection() }),

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
            const transition = workspace.dissolveSubgraph(state, subgraphId, false);
            state = transition.state;
            changed ||= transition.changed;
            notice = transition.notice ?? notice;
          }
          const transition = workspace.deleteElements(
            state,
            selection.nodeIds.filter((nodeId) => !childIdsOfDeletedSubgraphs.has(nodeId)),
            deletableEdgeIds,
            false,
          );
          state = transition.state;
          changed ||= transition.changed;
          notice = transition.notice ?? notice;
          if (changed) {
            commitWithLayout(
              withScheduledWorkflowLayout({ state, changed, notice }),
              { selection: emptySelection() },
            );
          }
        },

        copySelection: () => set({ clipboardNodeIds: [...get().selection.nodeIds] }),

        pasteSelection: () => {
          const transition = workspace.duplicateNodes(currentCore(), get().clipboardNodeIds);
          const nodeIds = transition.result?.nodeIds ?? [];
          commitWithLayout(transition, {
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
          commitWithLayout(transition, {
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
          const restored = coreOf(previous);
          if (state.layoutPending) unresolvedHistoryLayouts.add(graphSignature(state.graph));
          const restoredNeedsLayout = unresolvedHistoryLayouts.delete(graphSignature(restored.graph));
          graphMutationRevision += 1;
          layoutRequestRevision += 1;
          proposalLayoutRequestRevision += 1;
          set({
            ...restored,
            past: state.past.slice(0, -1),
            future: [coreOf(state), ...state.future.slice(0, 49)],
            selection: selectionForGraph(restored.graph, state.selection),
            notice: 'Undid the last graph edit.',
            proposalPreviewGraph: null,
            layoutPending: restoredNeedsLayout,
          });
          if (restoredNeedsLayout) {
            applyAsyncLayout(restored.graph, layoutWorkflowGraph(structuredClone(restored.graph)));
          }
        },

        redo: () => {
          const state = get();
          if (state.future.length === 0 || state.graph.status === 'frozen' || state.proposal) return;
          const next = state.future[0];
          const restored = coreOf(next);
          if (state.layoutPending) unresolvedHistoryLayouts.add(graphSignature(state.graph));
          const restoredNeedsLayout = unresolvedHistoryLayouts.delete(graphSignature(restored.graph));
          graphMutationRevision += 1;
          layoutRequestRevision += 1;
          proposalLayoutRequestRevision += 1;
          set({
            ...restored,
            past: [...state.past.slice(-49), coreOf(state)],
            future: state.future.slice(1),
            selection: selectionForGraph(restored.graph, state.selection),
            notice: 'Redid the graph edit.',
            proposalPreviewGraph: null,
            layoutPending: restoredNeedsLayout,
          });
          if (restoredNeedsLayout) {
            applyAsyncLayout(restored.graph, layoutWorkflowGraph(structuredClone(restored.graph)));
          }
        },

        submitProposal: (input) => {
          if (get().layoutPending) {
            return {
              ok: false,
              error: {
                code: 'LAYOUT_PENDING',
                message: 'Wait for the current graph arrangement to finish before proposing changes.',
              },
            };
          }
          const transition = workspace.submitProposal(currentCore(), input);
          commit(transition, { history: false });
          if (transition.proposalLayoutPromise && transition.result?.ok) {
            applyAsyncProposalLayout(
              transition.result.proposal.id,
              transition.state.graph,
              transition.proposalLayoutPromise,
            );
          }
          return transition.result!;
        },

        approveProposal: () => {
          const transition = workspace.approveProposal(currentCore());
          commitWithLayout(transition, { history: false, selection: emptySelection() });
          return transition.result!;
        },

        requestProposalChanges: (submission) => {
          const transition = workspace.requestProposalChanges(currentCore(), submission);
          commit(transition, { history: false, selection: emptySelection() });
          return transition.result!;
        },

        rejectProposal: () =>
          commit(workspace.rejectProposal(currentCore()), { history: false }),

        freezeGraph: () => {
          if (get().layoutPending) {
            return {
              ok: false,
              issues: [{
                code: 'LAYOUT_PENDING',
                message: 'Wait for the current graph arrangement to finish before freezing.',
                path: 'graph',
              }],
            };
          }
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
          const transition = workspace.resetGraph(currentCore());
          commit(transition, { selection: transition.changed ? emptySelection() : get().selection });
          if (transition.changed) {
            layoutRequestRevision += 1;
            proposalLayoutRequestRevision += 1;
            unresolvedHistoryLayouts.clear();
            set((state) => ({
              runtimeProjectionFixture: null,
              clipboardNodeIds: [],
              layoutPending: false,
              fitViewRevision: state.fitViewRevision + 1,
            }));
          }
        },

        loadGraphLibraryEntry: (entry) => {
          const transition = workspace.loadGraphLibraryEntry(currentCore(), entry);
          commitWithLayout(transition, {
            selection: transition.changed ? emptySelection() : get().selection,
          });
          if (transition.changed) {
            set((state) => ({
              runtimeProjectionFixture: runtimeFixtureForLoadedDynamicParallelismDemo(get().graph),
              clipboardNodeIds: [],
              fitViewRevision: transition.layoutPromise
                ? state.fitViewRevision
                : state.fitViewRevision + 1,
            }));
          }
          return transition.changed;
        },

        loadResearchSupervisorDemo: () => {
          commit(workspace.loadResearchSupervisorDemo(currentCore()), { selection: emptySelection() });
          set((state) => ({
            runtimeProjectionFixture: null,
            clipboardNodeIds: [],
            fitViewRevision: state.fitViewRevision + 1,
          }));
        },

        loadResearchIntakeRoutingDemo: () => {
          commit(workspace.loadResearchIntakeRoutingDemo(currentCore()), { selection: emptySelection() });
          set((state) => ({
            runtimeProjectionFixture: null,
            clipboardNodeIds: [],
            fitViewRevision: state.fitViewRevision + 1,
          }));
        },

        loadHumanControlHitlDemo: () => {
          commit(workspace.loadHumanControlHitlDemo(currentCore()), { selection: emptySelection() });
          set((state) => ({
            runtimeProjectionFixture: null,
            clipboardNodeIds: [],
            fitViewRevision: state.fitViewRevision + 1,
          }));
        },

        loadDynamicParallelismDemo: () => {
          commit(workspace.loadDynamicParallelismDemo(currentCore()), { selection: emptySelection() });
          set((state) => ({
            runtimeProjectionFixture: runtimeFixtureForLoadedDynamicParallelismDemo(get().graph),
            clipboardNodeIds: [],
            fitViewRevision: state.fitViewRevision + 1,
          }));
        },

        clearNotice: () => set({ notice: null }),
      };
    },
    {
      name: 'graphcontract-workspace-v1',
      // v9 persists compact human revision feedback while scenario
      // projections remain derived exclusively from the canonical graph.
      version: 9,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persistedState) =>
        migrateWorkspaceV7(persistedState, workspace.createInitial) as WorkspaceStore,
      // Zustand only invokes migrate when the stored version changes. Merge
      // also normalizes same-version snapshots so every frozen reload rebuilds
      // scenarios from its canonical graph rather than from persisted arrays.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...migrateWorkspaceV7(persistedState, workspace.createInitial),
      }) as WorkspaceStore,
      partialize: (state) => ({
        graph: state.graph,
        proposal: state.proposal,
        reviewRequest: state.reviewRequest ?? null,
      }),
    },
  ),
);
