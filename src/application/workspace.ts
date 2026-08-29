import {
  applyGraphOperations,
  BranchScenario,
  createProposal,
  enumerateScenarios,
  GraphEdge,
  GraphNode,
  GraphNodePatch,
  GraphProposal,
  GraphSubgraph,
  NodeKind,
  normalizeWorkflowGraphRouting,
  researchIntakeRoutingGraph,
  researchSupervisorGraph,
  sampleGraph,
  validateGraph,
  ValidationIssue,
  WorkflowGraph,
  StepExecutor,
} from '@/src/domain';
import { layoutWorkflowGraph } from './layout-workflow';
import { createDraftEdge } from './connection-policy';

export type WorkspaceCore = {
  graph: WorkflowGraph;
  proposal: GraphProposal | null;
  scenarios: BranchScenario[];
};

export type ProposalResult =
  | { ok: true; proposal: GraphProposal }
  | { ok: false; error: { code: string; message: string; issues?: ValidationIssue[] } };

export type FreezeResult =
  | { ok: true; scenarios: BranchScenario[] }
  | { ok: false; issues: ValidationIssue[] };

export type WorkspaceTransition<Result = undefined> = {
  state: WorkspaceCore;
  changed: boolean;
  notice?: string;
  result?: Result;
};

export type WorkspaceDependencies = {
  now: () => string;
  makeId: (prefix: string) => string;
};

/**
 * Creation remains a presentation choice. Every work-oriented preset creates
 * the same active graph kind (`step`) and selects only its executor defaults.
 */
export const stepPresetDefinitions = {
  step: { label: 'New Step', executor: 'deterministic' },
  agent: { label: 'New Agent', executor: 'ai' },
  action: { label: 'New Action', executor: 'deterministic' },
  tool: { label: 'New Tool', executor: 'tool' },
  humanReview: { label: 'Human review', executor: 'human' },
} as const satisfies Record<string, { label: string; executor: StepExecutor }>;

export type StepPreset = keyof typeof stepPresetDefinitions;
export type NodeCreationPreset = Extract<NodeKind, 'start' | 'end'> | StepPreset;

const structuralPresetLabels: Record<Extract<NodeKind, 'start' | 'end'>, string> = {
  start: 'Start',
  end: 'End',
};

function createNodeFromPreset(
  dependencies: WorkspaceDependencies,
  preset: NodeCreationPreset,
  position: { x: number; y: number },
): GraphNode {
  if (preset === 'start' || preset === 'end') {
    return {
      id: dependencies.makeId(preset),
      kind: preset,
      label: structuralPresetLabels[preset],
      position,
    };
  }

  const definition = stepPresetDefinitions[preset];
  return {
    id: dependencies.makeId('step'),
    kind: 'step',
    executor: definition.executor,
    label: definition.label,
    position,
  };
}

const clone = <T,>(value: T): T => structuredClone(value);
const hasStepOnlyPatchFields = (patch: GraphNodePatch) =>
  ['executor', 'participation', 'modifiers', 'hitl'].some((field) => field in patch);
const CANVAS_NODE_WIDTH = 184;
const CANVAS_NODE_HEIGHT = 114;
const SUBGRAPH_BODY_INSET = 12;
const SUBGRAPH_HEADER_HEIGHT = 56;

const absoluteNodePosition = (graph: WorkflowGraph, node: GraphNode): GraphNode['position'] => {
  const parent = graph.subgraphs.find((subgraph) => subgraph.id === node.parentId);
  return parent
    ? { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
    : node.position;
};

const removeParent = (node: GraphNode, position: GraphNode['position']): GraphNode => {
  // Keep the canonical input immutable; this helper is also used by dissolve
  // and inspector-driven removal paths.
  const unparented = { ...node };
  delete unparented.parentId;
  return { ...unparented, position };
};

/**
 * A drop belongs to a subgraph only when the visible node centre lands in its
 * body (not its title bar) and exactly one expanded container contains it.
 * This deliberately leaves overlapping containers and collapsed cards alone.
 */
const dropParentForNode = (
  graph: WorkflowGraph,
  node: GraphNode,
): GraphSubgraph | undefined => {
  const absolute = absoluteNodePosition(graph, node);
  const centre = {
    x: absolute.x + CANVAS_NODE_WIDTH / 2,
    y: absolute.y + CANVAS_NODE_HEIGHT / 2,
  };
  const matches = graph.subgraphs.filter(
    (subgraph) =>
      !subgraph.collapsed &&
      centre.x > subgraph.position.x + SUBGRAPH_BODY_INSET &&
      centre.x < subgraph.position.x + subgraph.dimensions.width - SUBGRAPH_BODY_INSET &&
      centre.y > subgraph.position.y + SUBGRAPH_HEADER_HEIGHT &&
      centre.y < subgraph.position.y + subgraph.dimensions.height - SUBGRAPH_BODY_INSET,
  );
  return matches.length === 1 ? matches[0] : undefined;
};

export function createWorkspaceService(dependencies: WorkspaceDependencies) {
  const createInitial = (): WorkspaceCore => ({
    graph: { ...clone(sampleGraph), updatedAt: dependencies.now() },
    proposal: null,
    scenarios: [],
  });

  const editable = (state: WorkspaceCore) =>
    state.graph.status === 'draft' && state.proposal === null;

  const blocked = (state: WorkspaceCore): WorkspaceTransition => ({
    state,
    changed: false,
    notice:
      state.graph.status === 'frozen'
        ? 'Unfreeze the contract before editing.'
        : 'Approve or reject the agent proposal before editing the accepted graph.',
  });

  const changeGraph = (
    state: WorkspaceCore,
    updater: (graph: WorkflowGraph) => WorkflowGraph,
    notice?: string,
  ): WorkspaceTransition => {
    if (!editable(state)) return blocked(state);
    const graph = normalizeWorkflowGraphRouting(updater(clone(state.graph)));
    graph.updatedAt = dependencies.now();
    graph.status = 'draft';
    return { state: { graph, proposal: null, scenarios: [] }, changed: true, notice };
  };

  return {
    createInitial,

    addNode(
      state: WorkspaceCore,
      preset: NodeCreationPreset,
      position: { x: number; y: number },
    ): WorkspaceTransition<{ nodeId: string }> {
      if (!editable(state)) return { ...blocked(state), result: undefined };
      const node = createNodeFromPreset(dependencies, preset, position);
      const transition = changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: [...graph.nodes, node],
        }),
        'Node added. Configure it in the inspector.',
      );
      return { ...transition, result: { nodeId: node.id } };
    },

    moveNode(state: WorkspaceCore, nodeId: string, position: GraphNode['position']) {
      return changeGraph(state, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
      }));
    },

    moveNodes(state: WorkspaceCore, positions: Record<string, GraphNode['position']>) {
      return changeGraph(state, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) =>
          positions[node.id] ? { ...node, position: positions[node.id] } : node,
        ),
      }));
    },

    /**
     * React Flow reports child positions relative to their current parent and
     * root positions in canvas coordinates. Apply those coordinates first,
     * then resolve a deliberate expanded-container drop from absolute canvas
     * geometry. The movement and any membership conversion form one history
     * transition at the store seam.
     */
    moveCanvasElements(
      state: WorkspaceCore,
      positions: Record<string, GraphNode['position']>,
    ) {
      const movedIds = new Set(Object.keys(positions));
      if (movedIds.size === 0) return { state, changed: false };
      return changeGraph(state, (graph) => {
        const moved = {
          ...graph,
          nodes: graph.nodes.map((node) =>
            positions[node.id] ? { ...node, position: positions[node.id] } : node,
          ),
          subgraphs: graph.subgraphs.map((subgraph) =>
            positions[subgraph.id]
              ? { ...subgraph, position: positions[subgraph.id] }
              : subgraph,
          ),
        };

        return {
          ...moved,
          nodes: moved.nodes.map((node) => {
            // Container positions were handled above. Only GraphNode records
            // can reach this membership conversion.
            if (!movedIds.has(node.id)) return node;
            const parent = dropParentForNode(moved, node);
            if (!parent || node.parentId === parent.id) return node;
            const absolute = absoluteNodePosition(moved, node);
            return {
              ...node,
              parentId: parent.id,
              position: {
                x: absolute.x - parent.position.x,
                y: absolute.y - parent.position.y,
              },
            };
          }),
        };
      }, 'Node movement saved. Dropped nodes join one unambiguous expanded subgraph.');
    },

    updateNode(
      state: WorkspaceCore,
      nodeId: string,
      patch: GraphNodePatch,
    ) {
      const node = state.graph.nodes.find((candidate) => candidate.id === nodeId);
      if (node && node.kind !== 'step' && hasStepOnlyPatchFields(patch)) {
        return {
          state,
          changed: false,
          notice: 'Step-only fields can only update Step nodes.',
        };
      }
      return changeGraph(state, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
      }));
    },

    createSubgraph(
      state: WorkspaceCore,
      input: {
        label?: string;
        position: GraphSubgraph['position'];
        dimensions?: GraphSubgraph['dimensions'];
        collapsed?: boolean;
      },
    ): WorkspaceTransition<{ subgraphId: string }> {
      if (!editable(state)) return { ...blocked(state), result: undefined };
      const subgraphId = dependencies.makeId('subgraph');
      const transition = changeGraph(
        state,
        (graph) => ({
          ...graph,
          subgraphs: [
            ...graph.subgraphs,
            {
              id: subgraphId,
              label: input.label ?? 'New Subgraph',
              position: input.position,
              dimensions: input.dimensions ?? { width: 640, height: 360 },
              collapsed: input.collapsed ?? false,
            },
          ],
        }),
        'Subgraph added. Add its Start and End nodes to complete the workflow.',
      );
      return { ...transition, result: { subgraphId } };
    },

    updateSubgraph(
      state: WorkspaceCore,
      subgraphId: string,
      patch: Partial<Omit<GraphSubgraph, 'id'>>,
    ) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      return changeGraph(state, (graph) => ({
        ...graph,
        subgraphs: graph.subgraphs.map((subgraph) =>
          subgraph.id === subgraphId ? { ...subgraph, ...patch } : subgraph,
        ),
      }));
    },

    moveSubgraph(
      state: WorkspaceCore,
      subgraphId: string,
      position: GraphSubgraph['position'],
    ) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      // Child positions are canonical relative coordinates, so moving a
      // container changes only its own position.
      return changeGraph(state, (graph) => ({
        ...graph,
        subgraphs: graph.subgraphs.map((subgraph) =>
          subgraph.id === subgraphId ? { ...subgraph, position } : subgraph,
        ),
      }));
    },

    setSubgraphCollapsed(state: WorkspaceCore, subgraphId: string, collapsed: boolean) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      // Collapse is view state on the canonical container; its edges are never
      // rewritten, hidden, or otherwise changed here.
      return changeGraph(state, (graph) => ({
        ...graph,
        subgraphs: graph.subgraphs.map((subgraph) =>
          subgraph.id === subgraphId ? { ...subgraph, collapsed } : subgraph,
        ),
      }));
    },

    assignNodesToSubgraph(state: WorkspaceCore, subgraphId: string, nodeIds: string[]) {
      const target = state.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId);
      const requested = new Set(nodeIds);
      const selected = state.graph.nodes.filter(
        (node) => requested.has(node.id) && node.parentId !== subgraphId,
      );
      if (!target || selected.length === 0) return { state, changed: false };
      return changeGraph(
        state,
        (graph) => {
          const parent = graph.subgraphs.find((subgraph) => subgraph.id === subgraphId)!;
          return {
            ...graph,
            nodes: graph.nodes.map((node) => {
              if (!requested.has(node.id) || node.parentId === subgraphId) return node;
              const absolute = absoluteNodePosition(graph, node);
              return {
                ...node,
                parentId: subgraphId,
                position: {
                  x: absolute.x - parent.position.x,
                  y: absolute.y - parent.position.y,
                },
              };
            }),
          };
        },
        'Nodes assigned to subgraph with relative positions preserved.',
      );
    },

    assignNodeToSubgraph(state: WorkspaceCore, subgraphId: string, nodeId: string) {
      const target = state.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId);
      const node = state.graph.nodes.find(
        (candidate) => candidate.id === nodeId && candidate.parentId !== subgraphId,
      );
      if (!target || !node) return { state, changed: false };
      return changeGraph(
        state,
        (graph) => {
          const parent = graph.subgraphs.find((subgraph) => subgraph.id === subgraphId)!;
          const current = graph.nodes.find((candidate) => candidate.id === nodeId)!;
          const absolute = absoluteNodePosition(graph, current);
          return {
            ...graph,
            nodes: graph.nodes.map((candidate) =>
              candidate.id === nodeId
                ? {
                    ...candidate,
                    parentId: subgraphId,
                    position: {
                      x: absolute.x - parent.position.x,
                      y: absolute.y - parent.position.y,
                    },
                  }
                : candidate,
            ),
          };
        },
        'Node assigned to subgraph with its relative position preserved.',
      );
    },

    removeNodesFromSubgraph(state: WorkspaceCore, nodeIds: string[]) {
      const requested = new Set(nodeIds);
      const selected = state.graph.nodes.filter((node) => requested.has(node.id) && node.parentId);
      if (selected.length === 0) return { state, changed: false };
      return changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) =>
            requested.has(node.id) && node.parentId
              ? removeParent(node, absoluteNodePosition(graph, node))
              : node,
          ),
        }),
        'Nodes removed from subgraph with absolute positions preserved.',
      );
    },

    removeNodeFromSubgraph(state: WorkspaceCore, nodeId: string) {
      const node = state.graph.nodes.find((candidate) => candidate.id === nodeId && candidate.parentId);
      if (!node) return { state, changed: false };
      return changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: graph.nodes.map((candidate) =>
            candidate.id === nodeId
              ? removeParent(candidate, absoluteNodePosition(graph, candidate))
              : candidate,
          ),
        }),
        'Node removed from subgraph with its absolute position preserved.',
      );
    },

    dissolveSubgraph(state: WorkspaceCore, subgraphId: string) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      return changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) =>
            node.parentId === subgraphId
              ? removeParent(node, absoluteNodePosition(graph, node))
              : node,
          ),
          subgraphs: graph.subgraphs.filter((subgraph) => subgraph.id !== subgraphId),
        }),
        'Subgraph dissolved. Its child nodes remain at their absolute positions.',
      );
    },

    removeNode(state: WorkspaceCore, nodeId: string) {
      return changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => node.id !== nodeId),
          edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        }),
        'Node and connected edges removed.',
      );
    },

    addEdge(state: WorkspaceCore, source: string, target: string) {
      if (source === target) return { state, changed: false };
      const edgeId = dependencies.makeId('edge');
      const transition = changeGraph(
        state,
        (graph) => ({
          ...graph,
          edges: [...graph.edges, createDraftEdge(graph, edgeId, source, target)],
        }),
        'Edge added. Configure its routing in the inspector.',
      );
      return { ...transition, result: transition.changed ? { edgeId } : undefined };
    },

    updateEdge(
      state: WorkspaceCore,
      edgeId: string,
      patch: Partial<Omit<GraphEdge, 'id'>>,
    ) {
      return changeGraph(state, (graph) => ({
        ...graph,
        edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
      }));
    },

    removeEdge(state: WorkspaceCore, edgeId: string) {
      return changeGraph(
        state,
        (graph) => ({ ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) }),
        'Edge removed.',
      );
    },

    deleteElements(state: WorkspaceCore, nodeIds: string[], edgeIds: string[]) {
      const removedNodes = new Set(nodeIds);
      const removedEdges = new Set(edgeIds);
      return changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => !removedNodes.has(node.id)),
          edges: graph.edges.filter(
            (edge) =>
              !removedEdges.has(edge.id) &&
              !removedNodes.has(edge.source) &&
              !removedNodes.has(edge.target),
          ),
        }),
        'Selected elements removed.',
      );
    },

    duplicateNodes(state: WorkspaceCore, nodeIds: string[], offset = { x: 36, y: 36 }) {
      if (!editable(state)) return { ...blocked(state), result: undefined };
      const selected = state.graph.nodes.filter((node) => nodeIds.includes(node.id));
      if (selected.length === 0) return { state, changed: false, result: undefined };
      const idMap = new Map(selected.map((node) => [node.id, dependencies.makeId(node.kind)]));
      const copies = selected.map((node) => ({
        ...clone(node),
        id: idMap.get(node.id)!,
        label: `${node.label} copy`,
        position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      }));
      const internalEdges = state.graph.edges
        .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
        .map((edge) => ({
          ...clone(edge),
          id: dependencies.makeId('edge'),
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        }));
      const transition = changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: [...graph.nodes, ...copies],
          edges: [...graph.edges, ...internalEdges],
        }),
        `${copies.length} node${copies.length === 1 ? '' : 's'} duplicated.`,
      );
      return { ...transition, result: { nodeIds: copies.map((node) => node.id) } };
    },

    submitProposal(state: WorkspaceCore, input: unknown): WorkspaceTransition<ProposalResult> {
      if (state.proposal) {
        const error = {
          code: 'PENDING_PROPOSAL_EXISTS',
          message: 'Review the current proposal before submitting another one.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      const result = createProposal(state.graph, input);
      if (!result.proposal) {
        return { state, changed: false, result: { ok: false, error: result.error! } };
      }
      return {
        state: { ...state, proposal: result.proposal },
        changed: true,
        notice:
          result.proposal.status === 'pending'
            ? 'A new agent proposal is ready for human review.'
            : 'The agent proposal is invalid. Review its validation issues.',
        result: { ok: true, proposal: result.proposal },
      };
    },

    approveProposal(state: WorkspaceCore): WorkspaceTransition<ProposalResult> {
      const proposal = state.proposal;
      if (!proposal || proposal.status !== 'pending') {
        const error = {
          code: 'PROPOSAL_INVALID',
          message: 'There is no valid pending proposal to approve.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      if (proposal.baseUpdatedAt !== state.graph.updatedAt) {
        const stale = { ...proposal, status: 'stale' as const };
        const error = {
          code: 'PROPOSAL_STALE',
          message: 'The graph changed after this proposal was created.',
        };
        return {
          state: { ...state, proposal: stale },
          changed: true,
          notice: 'Proposal is stale. Ask the agent to read the graph again.',
          result: { ok: false, error },
        };
      }
      const applied = applyGraphOperations(state.graph, proposal.operations);
      const issues = [...applied.errors, ...validateGraph(applied.graph)];
      if (issues.length > 0) {
        const invalid = { ...proposal, status: 'invalid' as const, validationErrors: issues };
        return {
          state: { ...state, proposal: invalid },
          changed: true,
          notice: 'The proposal no longer produces a valid graph.',
          result: {
            ok: false,
            error: { code: 'PROPOSAL_INVALID', message: 'The proposed graph is invalid.', issues },
          },
        };
      }
      const hasStructuralChanges = proposal.operations.some((operation) =>
        ['add_node', 'remove_node', 'add_edge', 'remove_edge'].includes(operation.type),
      );
      const acceptedGraph = hasStructuralChanges
        ? layoutWorkflowGraph(applied.graph)
        : applied.graph;
      const graph = { ...acceptedGraph, status: 'draft' as const, updatedAt: dependencies.now() };
      return {
        state: { graph, proposal: null, scenarios: [] },
        changed: true,
        notice: 'Proposal approved and applied to the accepted graph.',
        result: { ok: true, proposal: { ...proposal, status: 'approved' } },
      };
    },

    rejectProposal(state: WorkspaceCore): WorkspaceTransition {
      if (!state.proposal) return { state, changed: false };
      return {
        state: { ...state, proposal: null },
        changed: true,
        notice: 'Proposal rejected. The accepted graph was not changed.',
      };
    },

    freezeGraph(state: WorkspaceCore): WorkspaceTransition<FreezeResult> {
      if (state.proposal) {
        const issues = [{
          code: 'PENDING_PROPOSAL_EXISTS',
          message: 'Approve or reject the proposal before freezing.',
        }];
        return { state, changed: false, notice: issues[0].message, result: { ok: false, issues } };
      }
      const issues = validateGraph(state.graph);
      if (issues.length > 0) {
        return {
          state,
          changed: false,
          notice: 'Resolve validation issues before freezing.',
          result: { ok: false, issues },
        };
      }
      const graph = { ...state.graph, status: 'frozen' as const, updatedAt: dependencies.now() };
      const scenarios = enumerateScenarios(graph);
      return {
        state: { graph, proposal: null, scenarios },
        changed: true,
        notice: `Contract frozen with ${scenarios.length} reachable paths.`,
        result: { ok: true, scenarios },
      };
    },

    unfreezeGraph(state: WorkspaceCore): WorkspaceTransition {
      if (state.graph.status !== 'frozen') return { state, changed: false };
      return {
        state: {
          graph: { ...state.graph, status: 'draft', updatedAt: dependencies.now() },
          proposal: null,
          scenarios: [],
        },
        changed: true,
        notice: 'Contract returned to draft mode.',
      };
    },

    resetGraph(state: WorkspaceCore): WorkspaceTransition {
      if (!editable(state)) return blocked(state);
      return {
        state: createInitial(),
        changed: true,
        notice: 'Sample workflow restored.',
      };
    },

    loadResearchSupervisorDemo(state: WorkspaceCore): WorkspaceTransition {
      return changeGraph(
        state,
        () => clone(researchSupervisorGraph),
        'Research Supervisor demo loaded.',
      );
    },

    loadResearchIntakeRoutingDemo(state: WorkspaceCore): WorkspaceTransition {
      return changeGraph(
        state,
        () => clone(researchIntakeRoutingGraph),
        'Research Intake Routing demo loaded.',
      );
    },
  };
}
