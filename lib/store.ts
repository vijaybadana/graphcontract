'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  applyGraphOperations,
  BranchScenario,
  createProposal,
  enumerateScenarios,
  GraphEdge,
  GraphNode,
  GraphProposal,
  NodeKind,
  sampleGraph,
  validateGraph,
  ValidationIssue,
  WorkflowGraph,
} from './graph';

type Selection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null;

type ProposalResult =
  | { ok: true; proposal: GraphProposal }
  | { ok: false; error: { code: string; message: string; issues?: ValidationIssue[] } };

type FreezeResult =
  | { ok: true; scenarios: BranchScenario[] }
  | { ok: false; issues: ValidationIssue[] };

type GraphState = {
  graph: WorkflowGraph;
  proposal: GraphProposal | null;
  scenarios: BranchScenario[];
  selection: Selection;
  notice: string | null;
  addNode: (kind: NodeKind, position?: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, patch: Partial<Omit<GraphNode, 'id'>>) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string) => void;
  updateEdge: (id: string, patch: Partial<Omit<GraphEdge, 'id'>>) => void;
  removeEdge: (id: string) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  submitProposal: (input: unknown) => ProposalResult;
  approveProposal: () => ProposalResult;
  rejectProposal: () => void;
  freezeGraph: () => FreezeResult;
  unfreezeGraph: () => void;
  resetGraph: () => void;
  clearNotice: () => void;
};

const now = () => new Date().toISOString();
const cloneSample = (): WorkflowGraph => ({ ...structuredClone(sampleGraph), updatedAt: now() });
const makeId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;

const labels: Record<NodeKind, string> = {
  start: 'Start',
  agent: 'New Agent',
  action: 'New Action',
  tool: 'New Tool',
  human_input: 'Human Input',
  end: 'End',
};

const changeGraph = (
  state: Pick<GraphState, 'graph' | 'proposal'>,
  updater: (graph: WorkflowGraph) => WorkflowGraph,
) => {
  const graph = updater(structuredClone(state.graph));
  graph.updatedAt = now();
  graph.status = 'draft';
  const proposal = state.proposal
    ? { ...state.proposal, status: 'stale' as const }
    : null;
  return { graph, proposal, scenarios: [] };
};

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      graph: cloneSample(),
      proposal: null,
      scenarios: [],
      selection: null,
      notice: null,

      addNode: (kind, position = { x: 360, y: 180 }) => {
        if (get().graph.status === 'frozen') return;
        set((state) => {
          const id = makeId(kind);
          const next = changeGraph(state, (graph) => ({
            ...graph,
            nodes: [
              ...graph.nodes,
              {
                id,
                kind,
                label: labels[kind],
                position,
                ...(kind === 'agent' || kind === 'action' || kind === 'tool'
                  ? { hitl: { enabled: false } }
                  : {}),
              },
            ],
          }));
          return { ...next, selection: { type: 'node' as const, id }, notice: 'Node added. Configure it in the inspector.' };
        });
      },

      moveNode: (id, position) => {
        if (get().graph.status === 'frozen') return;
        set((state) => changeGraph(state, (graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) => (node.id === id ? { ...node, position } : node)),
        })));
      },

      updateNode: (id, patch) => {
        if (get().graph.status === 'frozen') return;
        set((state) => changeGraph(state, (graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
        })));
      },

      removeNode: (id) => {
        if (get().graph.status === 'frozen') return;
        set((state) => ({
          ...changeGraph(state, (graph) => ({
            ...graph,
            nodes: graph.nodes.filter((node) => node.id !== id),
            edges: graph.edges.filter((edge) => edge.source !== id && edge.target !== id),
          })),
          selection: null,
          notice: 'Node and connected edges removed.',
        }));
      },

      addEdge: (source, target) => {
        if (get().graph.status === 'frozen' || source === target) return;
        set((state) => {
          const id = makeId('edge');
          const next = changeGraph(state, (graph) => ({
            ...graph,
            edges: [...graph.edges, { id, source, target, mode: 'normal' }],
          }));
          return { ...next, selection: { type: 'edge' as const, id }, notice: 'Edge added. Choose its routing mode in the inspector.' };
        });
      },

      updateEdge: (id, patch) => {
        if (get().graph.status === 'frozen') return;
        set((state) => changeGraph(state, (graph) => ({
          ...graph,
          edges: graph.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)),
        })));
      },

      removeEdge: (id) => {
        if (get().graph.status === 'frozen') return;
        set((state) => ({
          ...changeGraph(state, (graph) => ({
            ...graph,
            edges: graph.edges.filter((edge) => edge.id !== id),
          })),
          selection: null,
          notice: 'Edge removed.',
        }));
      },

      setSelection: (selection) => set({ selection }),
      clearSelection: () => set({ selection: null }),

      submitProposal: (input) => {
        const state = get();
        if (state.proposal?.status === 'pending') {
          return {
            ok: false,
            error: {
              code: 'PENDING_PROPOSAL_EXISTS',
              message: 'Review the current proposal before submitting another one.',
            },
          };
        }
        const result = createProposal(state.graph, input);
        if (!result.proposal) return { ok: false, error: result.error! };
        set({
          proposal: result.proposal,
          notice:
            result.proposal.status === 'pending'
              ? 'A new agent proposal is ready for human review.'
              : 'The agent proposal is invalid. Review its validation issues.',
        });
        return { ok: true, proposal: result.proposal };
      },

      approveProposal: () => {
        const state = get();
        const proposal = state.proposal;
        if (!proposal || proposal.status !== 'pending') {
          return {
            ok: false,
            error: { code: 'PROPOSAL_INVALID', message: 'There is no valid pending proposal to approve.' },
          };
        }
        if (proposal.baseUpdatedAt !== state.graph.updatedAt) {
          set({ proposal: { ...proposal, status: 'stale' }, notice: 'Proposal is stale. Ask the agent to read the graph again.' });
          return {
            ok: false,
            error: { code: 'PROPOSAL_STALE', message: 'The graph changed after this proposal was created.' },
          };
        }

        const applied = applyGraphOperations(state.graph, proposal.operations);
        const issues = [...applied.errors, ...validateGraph(applied.graph)];
        if (issues.length > 0) {
          const invalid = { ...proposal, status: 'invalid' as const, validationErrors: issues };
          set({ proposal: invalid, notice: 'The proposal no longer produces a valid graph.' });
          return {
            ok: false,
            error: { code: 'PROPOSAL_INVALID', message: 'The proposed graph is invalid.', issues },
          };
        }

        const graph = { ...applied.graph, status: 'draft' as const, updatedAt: now() };
        set({ graph, proposal: null, scenarios: [], notice: 'Proposal approved and applied to the accepted graph.' });
        return { ok: true, proposal: { ...proposal, status: 'approved' } };
      },

      rejectProposal: () => {
        if (!get().proposal) return;
        set({ proposal: null, notice: 'Proposal rejected. The accepted graph was not changed.' });
      },

      freezeGraph: () => {
        const graph = get().graph;
        const issues = validateGraph(graph);
        if (issues.length > 0) {
          set({ notice: 'Resolve validation issues before freezing.' });
          return { ok: false, issues };
        }
        if (get().proposal?.status === 'pending') {
          const pendingIssue: ValidationIssue = {
            code: 'PENDING_PROPOSAL_EXISTS',
            message: 'Approve or reject the pending proposal before freezing.',
          };
          set({ notice: pendingIssue.message });
          return { ok: false, issues: [pendingIssue] };
        }
        const frozen = { ...graph, status: 'frozen' as const, updatedAt: now() };
        const scenarios = enumerateScenarios(frozen);
        set({ graph: frozen, scenarios, selection: null, notice: `Contract frozen with ${scenarios.length} reachable paths.` });
        return { ok: true, scenarios };
      },

      unfreezeGraph: () => {
        const graph = get().graph;
        set({
          graph: { ...graph, status: 'draft', updatedAt: now() },
          scenarios: [],
          notice: 'Contract returned to draft mode.',
        });
      },

      resetGraph: () =>
        set({
          graph: cloneSample(),
          proposal: null,
          scenarios: [],
          selection: null,
          notice: 'Sample workflow restored.',
        }),

      clearNotice: () => set({ notice: null }),
    }),
    {
      name: 'graphcontract-workspace-v1',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        graph: state.graph,
        proposal: state.proposal,
        scenarios: state.scenarios,
      }),
    },
  ),
);
