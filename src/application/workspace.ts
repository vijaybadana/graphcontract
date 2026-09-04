import {
  applyGraphOperations,
  BranchScenario,
  createProposal,
  enumerateScenariosBounded,
  GraphEdgePatch,
  GraphCapabilities,
  GraphCapabilityOverrides,
  GraphNode,
  GraphNodePatch,
  GraphProposal,
  GraphSubgraph,
  NodeKind,
  normalizeWorkflowGraph,
  proposalMatchesGraph,
  researchIntakeRoutingGraph,
  researchSupervisorGraph,
  humanControlHitlDemoGraph,
  sampleGraph,
  validateGraph,
  ValidationIssue,
  WorkflowGraph,
  StepExecutor,
  StepGraphNode,
  StepStoreAccess,
  RetryPolicy,
  ScenarioEnumerationBudget,
} from '@/src/domain';
import { dynamicParallelismDemoGraph } from './package-three-demo';
import { layoutWorkflowGraph, type WorkflowLayoutOptions } from './layout-workflow';
import { createDraftEdge } from './connection-policy';
import { CONTRACT_NODE_HEIGHT, CONTRACT_NODE_WIDTH } from './canvas-geometry';
import {
  constrainSubgraphDimensions,
  subgraphResizeLimits,
} from './subgraph-resize';
import {
  constrainDynamicWorkerGroupDimensions,
  dynamicWorkerGroupLayout,
} from './dynamic-worker-layout';
import { deriveProposalComparison } from './proposal-comparison';
import {
  type ProposalReviewNote,
  type ProposalReviewSubmission,
  resolveProposalReviewNotes,
} from './proposal-review';

export type WorkspaceCore = {
  graph: WorkflowGraph;
  proposal: GraphProposal | null;
  /** Human-authored revision feedback. It is review state, never graph data. */
  reviewRequest?: ProposalReviewRequest | null;
  scenarios: BranchScenario[];
};

export type ProposalReviewRequest = {
  status: 'changes_requested';
  feedback: string;
  proposalId: string;
  proposalCreatedAt: string;
  reviewedGraphId: string;
  reviewedGraphUpdatedAt: string;
  reviewedAt: string;
  /** Canonical, proposal-scoped targets resolved when the human submits review. */
  notes?: ProposalReviewNote[];
};

export type ProposalResult =
  | { ok: true; proposal: GraphProposal }
  | { ok: false; error: { code: string; message: string; issues?: ValidationIssue[] } };

export type RequestChangesResult =
  | { ok: true; reviewRequest: ProposalReviewRequest }
  | { ok: false; error: { code: string; message: string } };

export type FreezeResult =
  | { ok: true; scenarios: BranchScenario[] }
  | { ok: false; issues: ValidationIssue[] };

export type WorkspaceTransition<Result = undefined> = {
  state: WorkspaceCore;
  changed: boolean;
  notice?: string;
  result?: Result;
  /** Signals the UI store to coalesce a non-animated viewport fit. */
  layoutApplied?: boolean;
  /** Geometry is asynchronous; callers commit it only if their source revision remains current. */
  layoutPromise?: Promise<WorkflowGraph>;
  /** Candidate-only geometry for proposal projection; never accepted graph state. */
  proposalLayoutPromise?: Promise<WorkflowGraph>;
};

export type WorkspaceDependencies = {
  now: () => string;
  makeId: (prefix: string) => string;
  /** Optional only for deterministic tests or stricter embedding hosts. */
  scenarioBudget?: ScenarioEnumerationBudget;
};

/**
 * Creation remains a presentation choice. Every work-oriented preset creates
 * the same active graph kind (`step`) and selects only its executor defaults;
 * Merge is structural and never a Step preset.
 */
export const stepPresetDefinitions = {
  step: { label: 'New Step', executor: 'deterministic' },
  agent: { label: 'New Agent', executor: 'ai' },
  action: { label: 'New Action', executor: 'deterministic' },
  tool: { label: 'New Tool', executor: 'tool' },
  humanReview: { label: 'Human review', executor: 'human' },
} as const satisfies Record<string, { label: string; executor: StepExecutor }>;

export type StepPreset = keyof typeof stepPresetDefinitions;
export type NodeCreationPreset = Extract<NodeKind, 'start' | 'merge' | 'end'> | StepPreset;

const structuralPresetLabels: Record<Extract<NodeKind, 'start' | 'merge' | 'end'>, string> = {
  start: 'Start',
  merge: 'Merge',
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

  if (preset === 'merge') {
    return {
      id: dependencies.makeId('merge'),
      kind: 'merge',
      label: structuralPresetLabels.merge,
      position,
      merge: {
        reducer: { name: 'merge', aggregateState: 'aggregate' },
        completion: { mode: 'all' },
        continuation: { mode: 'once' },
        waitingForDynamicInputs: true,
      },
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

/**
 * Marks one accepted structural transition for a single asynchronous layout.
 * The store owns stale-result protection and commits the resolved geometry
 * without adding another history entry.
 */
export function withScheduledWorkflowLayout<Result>(
  transition: WorkspaceTransition<Result>,
  options: WorkflowLayoutOptions = {},
): WorkspaceTransition<Result> {
  if (!transition.changed) return transition;
  return {
    ...transition,
    layoutApplied: true,
    layoutPromise: layoutWorkflowGraph(clone(transition.state.graph), options),
  };
}
const hasStepOnlyPatchFields = (patch: GraphNodePatch) =>
  ['executor', 'participation', 'storeAccess', 'retry', 'modifiers', 'hitl', 'sensitive'].some((field) => field in patch);
const hasMergeOnlyPatchFields = (patch: GraphNodePatch) => 'merge' in patch;
const SUBGRAPH_BODY_INSET = 12;
const SUBGRAPH_HEADER_HEIGHT = 56;

const absoluteSubgraphPosition = (
  graph: WorkflowGraph,
  subgraph: GraphSubgraph,
): GraphSubgraph['position'] => {
  const position = { ...subgraph.position };
  const visited = new Set([subgraph.id]);
  let parentId = subgraph.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = graph.subgraphs.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
};

const absoluteNodePosition = (graph: WorkflowGraph, node: GraphNode): GraphNode['position'] => {
  const parent = graph.subgraphs.find((subgraph) => subgraph.id === node.parentId);
  if (!parent) return node.position;
  const parentPosition = absoluteSubgraphPosition(graph, parent);
  return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y };
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
    x: absolute.x + CONTRACT_NODE_WIDTH / 2,
    y: absolute.y + CONTRACT_NODE_HEIGHT / 2,
  };
  const matches = graph.subgraphs.filter((subgraph) => {
    if (subgraph.collapsed) return false;
    const position = absoluteSubgraphPosition(graph, subgraph);
    return centre.x > position.x + SUBGRAPH_BODY_INSET &&
      centre.x < position.x + subgraph.dimensions.width - SUBGRAPH_BODY_INSET &&
      centre.y > position.y + SUBGRAPH_HEADER_HEIGHT &&
      centre.y < position.y + subgraph.dimensions.height - SUBGRAPH_BODY_INSET;
  });
  if (matches.length === 0) return undefined;
  const matchIds = new Set(matches.map((subgraph) => subgraph.id));
  const innermost = matches.filter(
    (candidate) => !graph.subgraphs.some(
      (other) => other.parentId === candidate.id && matchIds.has(other.id),
    ),
  );
  return innermost.length === 1 ? innermost[0] : undefined;
};

export function createWorkspaceService(dependencies: WorkspaceDependencies) {
  const createInitial = (): WorkspaceCore => ({
    graph: normalizeWorkflowGraph({ ...clone(sampleGraph), updatedAt: dependencies.now() }),
    proposal: null,
    reviewRequest: null,
    scenarios: [],
  });

  const editable = (state: WorkspaceCore) =>
    state.graph.status === 'draft' && state.proposal === null;

  /**
   * A revision request belongs to both the candidate the human reviewed and
   * the accepted graph revision they reviewed it against. Keeping both checks
   * at this seam prevents a later proposal from consuming feedback that was
   * written for a different candidate or accepted revision.
   */
  const reviewRequestMatchesCurrentCandidate = (state: WorkspaceCore) => {
    const reviewRequest = state.reviewRequest;
    const proposal = state.proposal;
    return !!reviewRequest &&
      !!proposal &&
      reviewRequest.proposalId === proposal.id &&
      reviewRequest.proposalCreatedAt === proposal.createdAt &&
      reviewRequest.reviewedGraphId === state.graph.id &&
      reviewRequest.reviewedGraphUpdatedAt === state.graph.updatedAt &&
      proposalMatchesGraph(proposal, state.graph);
  };

  const blocked = (state: WorkspaceCore): WorkspaceTransition => ({
    state,
    changed: false,
    notice:
      state.graph.status === 'frozen'
        ? 'Unfreeze the contract before editing.'
        : 'Resolve the agent proposal before editing the accepted graph.',
  });

  const changeGraph = (
    state: WorkspaceCore,
    updater: (graph: WorkflowGraph) => WorkflowGraph,
    notice?: string,
  ): WorkspaceTransition => {
    if (!editable(state)) return blocked(state);
    const graph = normalizeWorkflowGraph(updater(clone(state.graph)));
    graph.updatedAt = dependencies.now();
    graph.status = 'draft';
    return { state: { ...state, graph, proposal: null, scenarios: [] }, changed: true, notice };
  };

  return {
    createInitial,

    /** Explicit layout uses the same service as structural edit scheduling. */
    autoLayout(state: WorkspaceCore): WorkspaceTransition {
      if (!editable(state)) return blocked(state);
      return {
        state: { ...state, scenarios: [] },
        changed: true,
        notice: 'Workflow arrangement started.',
        layoutPromise: layoutWorkflowGraph(clone(state.graph), {
          recomputeSubgraphDimensions: true,
        }).then((graph) => ({
          ...graph,
          status: 'draft' as const,
          updatedAt: dependencies.now(),
        })),
      };
    },

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
      return { ...withScheduledWorkflowLayout(transition), result: { nodeId: node.id } };
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
      const transition = changeGraph(state, (graph) => {
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
      const membershipChanged = transition.changed && transition.state.graph.nodes.some((node) => (
        node.parentId !== state.graph.nodes.find((candidate) => candidate.id === node.id)?.parentId
      ));
      return membershipChanged ? withScheduledWorkflowLayout(transition) : transition;
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
      if (node && node.kind !== 'merge' && hasMergeOnlyPatchFields(patch)) {
        return {
          state,
          changed: false,
          notice: 'Merge configuration can only update Merge nodes.',
        };
      }
      return changeGraph(state, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          if (node.kind !== 'step') return { ...node, ...patch } as GraphNode;
          const updated = { ...node, ...patch } as StepGraphNode;
          if (patch.sensitive === null) delete updated.sensitive;
          if (patch.storeAccess === null) {
            delete updated.storeAccess;
            if (updated.modifiers) {
              const remainingModifiers = { ...updated.modifiers };
              delete remainingModifiers.storeRead;
              delete remainingModifiers.storeWrite;
              if (Object.keys(remainingModifiers).length > 0) updated.modifiers = remainingModifiers;
              else delete updated.modifiers;
            }
          }
          if (patch.retry === null) {
            delete updated.retry;
            if (updated.modifiers) {
              const remainingModifiers = { ...updated.modifiers };
              delete remainingModifiers.retryFallback;
              if (Object.keys(remainingModifiers).length > 0) updated.modifiers = remainingModifiers;
              else delete updated.modifiers;
            }
          }
          if (patch.opaque === null) {
            delete updated.opaque;
            if (updated.modifiers) {
              const remainingModifiers = { ...updated.modifiers };
              delete remainingModifiers.opaque;
              if (Object.keys(remainingModifiers).length > 0) updated.modifiers = remainingModifiers;
              else delete updated.modifiers;
            }
          }
          return updated;
        }),
      }));
    },

    /** Direct human capability editing stays in the accepted-graph path. */
    updateGraphCapabilities(
      state: WorkspaceCore,
      patch: Partial<GraphCapabilities>,
    ) {
      return changeGraph(state, (graph) => ({
        ...graph,
        capabilities: { ...graph.capabilities, ...patch },
      }));
    },

    /**
     * An absent override deliberately means inherit. This keeps a human
     * subgraph edit separate from proposal authority and from topology.
     */
    setSubgraphCapabilityOverride(
      state: WorkspaceCore,
      subgraphId: string,
      capability: keyof GraphCapabilityOverrides,
      value: GraphCapabilityOverrides[keyof GraphCapabilityOverrides] | null,
    ) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      return changeGraph(state, (graph) => ({
        ...graph,
        subgraphs: graph.subgraphs.map((subgraph) => {
          if (subgraph.id !== subgraphId) return subgraph;
          const overrides = { ...subgraph.capabilityOverrides };
          if (value === null) delete overrides[capability];
          else if (capability === 'state') overrides.state = value as GraphCapabilities['state'];
          else if (capability === 'checkpointer') overrides.checkpointer = value as GraphCapabilities['checkpointer'];
          else overrides.store = value as GraphCapabilities['store'];
          const updated = { ...subgraph };
          if (Object.keys(overrides).length > 0) updated.capabilityOverrides = overrides;
          else delete updated.capabilityOverrides;
          return updated;
        }),
      }));
    },

    updateStepStoreAccess(
      state: WorkspaceCore,
      nodeId: string,
      storeAccess: StepStoreAccess | null,
    ) {
      return this.updateNode(state, nodeId, { storeAccess });
    },

    updateStepRetry(
      state: WorkspaceCore,
      nodeId: string,
      retry: RetryPolicy | null,
    ) {
      return this.updateNode(state, nodeId, { retry });
    },

    createSubgraph(
      state: WorkspaceCore,
      input: {
        label?: string;
        position: GraphSubgraph['position'];
        dimensions?: GraphSubgraph['dimensions'];
        collapsed?: boolean;
        parentId?: string;
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
              ...(input.parentId ? { parentId: input.parentId } : {}),
            },
          ],
        }),
        'Subgraph added. Add its Start and End nodes to complete the workflow.',
      );
      return { ...withScheduledWorkflowLayout(transition), result: { subgraphId } };
    },

    updateSubgraph(
      state: WorkspaceCore,
      subgraphId: string,
      patch: Partial<Omit<GraphSubgraph, 'id'>>,
    ) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      return changeGraph(state, (graph) => {
        const limits = patch.dimensions
          ? subgraphResizeLimits(graph, subgraphId)
          : undefined;
        const constrainedPatch = patch.dimensions && limits
          ? {
              ...patch,
              dimensions: constrainSubgraphDimensions(patch.dimensions, limits),
            }
          : patch;
        return {
          ...graph,
          subgraphs: graph.subgraphs.map((subgraph) =>
            subgraph.id === subgraphId ? { ...subgraph, ...constrainedPatch } : subgraph,
          ),
        };
      });
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

    moveDynamicWorkerGroup(
      state: WorkspaceCore,
      edgeId: string,
      position: GraphNode['position'],
    ) {
      const layout = dynamicWorkerGroupLayout(state.graph, edgeId);
      if (!layout) return { state, changed: false };
      const edge = state.graph.edges.find((candidate) => candidate.id === edgeId);
      const canonicalAnatomyNode = edge?.send?.templateAnatomy?.nodes.find(
        (node) => node.id === edge.send?.templateAnatomy?.canonicalTemplateNodeId,
      );
      if (!canonicalAnatomyNode) return { state, changed: false };

      return changeGraph(state, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => node.id === layout.templateNodeId
          ? {
              ...node,
              position: {
                x: position.x + canonicalAnatomyNode.position.x,
                y: position.y + canonicalAnatomyNode.position.y,
              },
            }
          : node),
      }), 'Dynamic worker template movement saved.');
    },

    resizeDynamicWorkerGroup(
      state: WorkspaceCore,
      edgeId: string,
      dimensions: GraphSubgraph['dimensions'],
    ) {
      if (!dynamicWorkerGroupLayout(state.graph, edgeId)) return { state, changed: false };
      return changeGraph(state, (graph) => {
        const constrained = constrainDynamicWorkerGroupDimensions(graph, edgeId, dimensions);
        return {
          ...graph,
          edges: graph.edges.map((edge) => (
            edge.id === edgeId && edge.mode === 'send' && edge.send?.templateAnatomy
              ? {
                  ...edge,
                  send: {
                    ...edge.send,
                    templateAnatomy: {
                      ...edge.send.templateAnatomy,
                      dimensions: constrained,
                    },
                  },
                }
              : edge
          )),
        };
      }, 'Dynamic worker template size saved.');
    },

    setSubgraphCollapsed(state: WorkspaceCore, subgraphId: string, collapsed: boolean) {
      if (!state.graph.subgraphs.some((subgraph) => subgraph.id === subgraphId)) {
        return { state, changed: false };
      }
      // Collapse is view state on the canonical container; its edges are never
      // rewritten, hidden, or otherwise changed here.
      const transition = changeGraph(state, (graph) => ({
        ...graph,
        subgraphs: graph.subgraphs.map((subgraph) =>
          subgraph.id === subgraphId ? { ...subgraph, collapsed } : subgraph,
        ),
      }));
      return withScheduledWorkflowLayout(transition);
    },

    assignNodesToSubgraph(state: WorkspaceCore, subgraphId: string, nodeIds: string[]) {
      const target = state.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId);
      const requested = new Set(nodeIds);
      const selected = state.graph.nodes.filter(
        (node) => requested.has(node.id) && node.parentId !== subgraphId,
      );
      if (!target || selected.length === 0) return { state, changed: false };
      return withScheduledWorkflowLayout(changeGraph(
        state,
        (graph) => {
          const parent = graph.subgraphs.find((subgraph) => subgraph.id === subgraphId)!;
          const parentPosition = absoluteSubgraphPosition(graph, parent);
          return {
            ...graph,
            nodes: graph.nodes.map((node) => {
              if (!requested.has(node.id) || node.parentId === subgraphId) return node;
              const absolute = absoluteNodePosition(graph, node);
              return {
                ...node,
                parentId: subgraphId,
                position: {
                  x: absolute.x - parentPosition.x,
                  y: absolute.y - parentPosition.y,
                },
              };
            }),
          };
        },
        'Nodes assigned to subgraph with relative positions preserved.',
      ));
    },

    assignNodeToSubgraph(state: WorkspaceCore, subgraphId: string, nodeId: string) {
      const target = state.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId);
      const node = state.graph.nodes.find(
        (candidate) => candidate.id === nodeId && candidate.parentId !== subgraphId,
      );
      if (!target || !node) return { state, changed: false };
      return withScheduledWorkflowLayout(changeGraph(
        state,
        (graph) => {
          const parent = graph.subgraphs.find((subgraph) => subgraph.id === subgraphId)!;
          const parentPosition = absoluteSubgraphPosition(graph, parent);
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
                      x: absolute.x - parentPosition.x,
                      y: absolute.y - parentPosition.y,
                    },
                  }
                : candidate,
            ),
          };
        },
        'Node assigned to subgraph with its relative position preserved.',
      ));
    },

    removeNodesFromSubgraph(state: WorkspaceCore, nodeIds: string[]) {
      const requested = new Set(nodeIds);
      const selected = state.graph.nodes.filter((node) => requested.has(node.id) && node.parentId);
      if (selected.length === 0) return { state, changed: false };
      return withScheduledWorkflowLayout(changeGraph(
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
      ));
    },

    removeNodeFromSubgraph(state: WorkspaceCore, nodeId: string) {
      const node = state.graph.nodes.find((candidate) => candidate.id === nodeId && candidate.parentId);
      if (!node) return { state, changed: false };
      return withScheduledWorkflowLayout(changeGraph(
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
      ));
    },

    dissolveSubgraph(state: WorkspaceCore, subgraphId: string, scheduleLayout = true) {
      const dissolved = state.graph.subgraphs.find((subgraph) => subgraph.id === subgraphId);
      if (!dissolved) {
        return { state, changed: false };
      }
      const transition = changeGraph(
        state,
        (graph) => {
          const parent = dissolved.parentId
            ? graph.subgraphs.find((subgraph) => subgraph.id === dissolved.parentId)
            : undefined;
          const parentPosition = parent ? absoluteSubgraphPosition(graph, parent) : undefined;
          const reparentPosition = (position: GraphSubgraph['position']) => parentPosition
            ? { x: position.x - parentPosition.x, y: position.y - parentPosition.y }
            : position;
          return {
            ...graph,
            nodes: graph.nodes.map((node) => {
              if (node.parentId !== subgraphId) return node;
              const position = reparentPosition(absoluteNodePosition(graph, node));
              return parent
                ? { ...node, parentId: parent.id, position }
                : removeParent(node, position);
            }),
            subgraphs: graph.subgraphs
              .filter((subgraph) => subgraph.id !== subgraphId)
              .map((subgraph) => {
                if (subgraph.parentId !== subgraphId) return subgraph;
                const position = reparentPosition(absoluteSubgraphPosition(graph, subgraph));
                if (parent) return { ...subgraph, parentId: parent.id, position };
                const reparented = { ...subgraph, position };
                delete reparented.parentId;
                return reparented;
              }),
          };
        },
        'Subgraph dissolved. Its child nodes remain at their absolute positions.',
      );
      return scheduleLayout ? withScheduledWorkflowLayout(transition) : transition;
    },

    removeNode(state: WorkspaceCore, nodeId: string) {
      return withScheduledWorkflowLayout(changeGraph(
        state,
        (graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => node.id !== nodeId),
          edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        }),
        'Node and connected edges removed.',
      ));
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
      return {
        ...withScheduledWorkflowLayout(transition),
        result: transition.changed ? { edgeId } : undefined,
      };
    },

    updateEdge(
      state: WorkspaceCore,
      edgeId: string,
      patch: GraphEdgePatch,
    ) {
      const transition = changeGraph(state, (graph) => ({
        ...graph,
        edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
      }));
      return ('source' in patch || 'target' in patch)
        ? withScheduledWorkflowLayout(transition)
        : transition;
    },

    removeEdge(state: WorkspaceCore, edgeId: string) {
      return withScheduledWorkflowLayout(changeGraph(
        state,
        (graph) => ({ ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) }),
        'Edge removed.',
      ));
    },

    deleteElements(
      state: WorkspaceCore,
      nodeIds: string[],
      edgeIds: string[],
      scheduleLayout = true,
    ) {
      const removedNodes = new Set(nodeIds);
      const removedEdges = new Set(edgeIds);
      const transition = changeGraph(
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
      return scheduleLayout ? withScheduledWorkflowLayout(transition) : transition;
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
      return {
        ...withScheduledWorkflowLayout(transition),
        result: { nodeIds: copies.map((node) => node.id) },
      };
    },

    submitProposal(state: WorkspaceCore, input: unknown): WorkspaceTransition<ProposalResult> {
      const replacingRequestedProposal = !!state.proposal && !!state.reviewRequest;
      if (state.proposal && !replacingRequestedProposal) {
        const error = {
          code: 'PENDING_PROPOSAL_EXISTS',
          message: 'Review the current proposal before submitting another one.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      if (replacingRequestedProposal && !reviewRequestMatchesCurrentCandidate(state)) {
        const error = {
          code: 'PROPOSAL_STALE',
          message: 'The requested revision no longer matches the accepted graph. Read it again before proposing changes.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      const result = createProposal(state.graph, input);
      if (!result.proposal) {
        return { state, changed: false, result: { ok: false, error: result.error! } };
      }
      if (replacingRequestedProposal &&
        (result.proposal.status !== 'pending' || !proposalMatchesGraph(result.proposal, state.graph))) {
        const error = {
          code: result.proposal.status === 'invalid' ? 'PROPOSAL_INVALID' : 'PROPOSAL_STALE',
          message:
            result.proposal.status === 'invalid'
              ? 'The replacement proposal is invalid. The requested candidate and feedback were retained.'
              : 'The replacement proposal no longer matches the accepted graph.',
          ...(result.proposal.validationErrors ? { issues: result.proposal.validationErrors } : {}),
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      return {
        state: {
          ...state,
          proposal: result.proposal,
          reviewRequest:
            result.proposal.status === 'pending'
              ? null
              : state.reviewRequest ?? null,
        },
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
      if (reviewRequestMatchesCurrentCandidate(state)) {
        const error = {
          code: 'PROPOSAL_CHANGES_REQUESTED',
          message: 'This reviewed candidate is awaiting a valid replacement and cannot be approved.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      if (!proposal || proposal.status !== 'pending') {
        const error = {
          code: 'PROPOSAL_INVALID',
          message: 'There is no valid pending proposal to approve.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      if (!proposalMatchesGraph(proposal, state.graph)) {
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
      const graph = { ...applied.graph, status: 'draft' as const, updatedAt: dependencies.now() };
      return {
        state: { ...state, graph, proposal: null, reviewRequest: null, scenarios: [] },
        changed: true,
        notice: 'Proposal approved and applied to the accepted graph.',
        result: { ok: true, proposal: { ...proposal, status: 'approved' } },
      };
    },

    rejectProposal(state: WorkspaceCore): WorkspaceTransition {
      if (!state.proposal) return { state, changed: false };
      if (reviewRequestMatchesCurrentCandidate(state)) {
        return {
          state,
          changed: false,
          notice: 'This reviewed candidate is awaiting a valid replacement.',
        };
      }
      return {
        state: { ...state, proposal: null },
        changed: true,
        notice: 'Proposal rejected. The accepted graph was not changed.',
      };
    },

    requestProposalChanges(
      state: WorkspaceCore,
      submission: string | ProposalReviewSubmission,
    ): WorkspaceTransition<RequestChangesResult> {
      const proposal = state.proposal;
      if (!proposal) {
        const error = {
          code: 'PROPOSAL_MISSING',
          message: 'There is no proposal awaiting human review.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      if (reviewRequestMatchesCurrentCandidate(state)) {
        const error = {
          code: 'PROPOSAL_CHANGES_ALREADY_REQUESTED',
          message: 'Changes were already requested for this candidate. Wait for a valid replacement.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      const normalizedFeedback = (typeof submission === 'string' ? submission : submission.feedback ?? '').trim();
      const noteInputs = typeof submission === 'string' ? [] : submission.notes ?? [];
      const review = deriveProposalComparison(state.graph, proposal);
      const resolvedNotes = resolveProposalReviewNotes(review, noteInputs);
      if (!resolvedNotes.ok) {
        const error = { code: 'REVIEW_NOTE_INVALID', message: resolvedNotes.message };
        return { state, changed: false, result: { ok: false, error } };
      }
      if (normalizedFeedback.length < 3 && resolvedNotes.notes.length === 0) {
        const error = {
          code: 'REVIEW_FEEDBACK_REQUIRED',
          message: 'Describe the requested revision using at least 3 non-space characters.',
        };
        return { state, changed: false, result: { ok: false, error } };
      }
      const reviewRequest: ProposalReviewRequest = {
        status: 'changes_requested',
        feedback: normalizedFeedback.length >= 3
          ? normalizedFeedback
          : 'Review notes are attached to specific proposed changes and paths.',
        proposalId: proposal.id,
        proposalCreatedAt: proposal.createdAt,
        reviewedGraphId: state.graph.id,
        reviewedGraphUpdatedAt: state.graph.updatedAt,
        reviewedAt: dependencies.now(),
        ...(resolvedNotes.notes.length > 0 ? { notes: resolvedNotes.notes } : {}),
      };
      return {
        // Preserve the reviewed candidate in full (operations, diff, and ID)
        // alongside the feedback so a replacement can be validated atomically.
        state: { ...state, proposal, reviewRequest },
        changed: true,
        notice: 'Changes requested. The accepted graph was not changed.',
        result: { ok: true, reviewRequest },
      };
    },

    freezeGraph(state: WorkspaceCore): WorkspaceTransition<FreezeResult> {
      if (state.proposal) {
        const issues = [{
          code: 'PENDING_PROPOSAL_EXISTS',
          message: 'Resolve the proposal before freezing.',
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
      const enumeration = enumerateScenariosBounded(graph, dependencies.scenarioBudget);
      if (!enumeration.ok) {
        const issues = [{
          code: enumeration.code,
          message: enumeration.message,
          path: 'scenarios',
        }];
        return {
          state,
          changed: false,
          notice: enumeration.message,
          result: { ok: false, issues },
        };
      }
      const scenarios = enumeration.scenarios;
      return {
        state: { ...state, graph, proposal: null, scenarios },
        changed: true,
        notice: `Contract frozen with ${scenarios.length} reachable paths.`,
        result: { ok: true, scenarios },
      };
    },

    unfreezeGraph(state: WorkspaceCore): WorkspaceTransition {
      if (state.graph.status !== 'frozen') return { state, changed: false };
      return {
        state: {
          ...state,
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

    loadGraphLibraryEntry(
      state: WorkspaceCore,
      entry: {
        title: string;
        graph: WorkflowGraph;
        layout?: {
          authoredSubgraphIds?: readonly string[];
          preserveGraphGeometry?: boolean;
        };
      },
    ): WorkspaceTransition {
      if (!editable(state)) return blocked(state);
      const issues = validateGraph(entry.graph);
      if (issues.length > 0) {
        return {
          state,
          changed: false,
          notice: `“${entry.title}” cannot be opened because its template is invalid.`,
        };
      }
      const transition = changeGraph(
        state,
        () => clone(entry.graph),
        `“${entry.title}” opened from the Graph Library. One Undo restores your previous workflow.`,
      );
      if (entry.layout?.preserveGraphGeometry) {
        return { ...transition, layoutApplied: true };
      }
      return withScheduledWorkflowLayout(transition, {
        authoredSubgraphIds: entry.layout?.authoredSubgraphIds
          ? new Set(entry.layout.authoredSubgraphIds)
          : undefined,
      });
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

    loadHumanControlHitlDemo(state: WorkspaceCore): WorkspaceTransition {
      return changeGraph(
        state,
        () => clone(humanControlHitlDemoGraph),
        'Human Control & HITL demo loaded.',
      );
    },

    loadDynamicParallelismDemo(state: WorkspaceCore): WorkspaceTransition {
      return changeGraph(
        state,
        () => clone(dynamicParallelismDemoGraph),
        'Parallel research demo loaded. Runtime workers are available as a read-only fixture.',
      );
    },
  };
}
