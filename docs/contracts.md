# GraphContract Data and WebMCP Contracts

> These contracts are provisional implementation guidance. Exact names, optional fields, and validation details may evolve while preserving the human-authority boundary and public WebMCP behavior.

## Core graph structures

```ts
type NodeKind = "start" | "step" | "merge" | "end";
type StepExecutor = "deterministic" | "ai" | "tool" | "human";
type EdgeMode = "normal" | "conditional" | "command" | "fallback" | "send";

type WorkingStateCapability = {
  enabled: boolean;
  schema: { fields: string[]; summary?: string };
  reducers: Array<{ key: string; summary: string }>;
};
type CheckpointerCapability = {
  enabled: boolean;
  backend?: string;
  durableThread: { required: boolean; threadIdSource?: string };
};
type LongTermStoreCapability = {
  available: boolean;
  namespace?: string;
  retention?: string;
};
type RuntimeModeCapability = {
  mode: "unspecified" | "text" | "voice";
  input?: "text" | "audio";
};
type GraphCapabilities = {
  state: WorkingStateCapability;
  checkpointer: CheckpointerCapability;
  store: LongTermStoreCapability;
  runtimeMode: RuntimeModeCapability;
};

type StepStoreAccess = {
  read?: { namespace?: string; key?: string };
  write?: { namespace?: string; key?: string; retention?: string };
};
type RetryPolicy = {
  maxAttempts?: number;
  backoff?: { strategy?: "fixed" | "exponential"; initialDelayMs?: number; maxDelayMs?: number };
  retryOn?: string[];
  fallback?: { provider?: string; model?: string };
};
type HitlConfig = { enabled: boolean; timing?: "before" | "inside" | "after" };
type MergeConfig = { reducer: { name: string; aggregateState: string }; completion: { mode: "all" | "any" | "quorum" }; continuation: { mode: "once" | "per_batch" }; waitingForDynamicInputs: true };
type GraphSubgraph = {
  id: string;
  label: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  collapsed: boolean;
  capabilityOverrides?: Partial<Pick<GraphCapabilities, "state" | "checkpointer" | "store">>;
};
type GraphNode =
  | { id: string; kind: "start" | "end"; label: string; position: { x: number; y: number }; parentId?: string }
  | { id: string; kind: "merge"; label: string; position: { x: number; y: number }; parentId?: string; merge: MergeConfig }
  | { id: string; kind: "step"; label: string; position: { x: number; y: number }; parentId?: string; executor: StepExecutor; storeAccess?: StepStoreAccess; retry?: RetryPolicy; hitl?: HitlConfig };
type GraphEdge = { id: string; source: string; target: string; mode: EdgeMode; label?: string; condition?: string; loopCap?: number };
type WorkflowGraph = {
  schemaVersion: "5";
  id: string;
  name: string;
  capabilities: GraphCapabilities;
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs: GraphSubgraph[];
  status: "draft" | "frozen";
  updatedAt: string;
};
```

## State, Checkpoint, Store, and Runtime scope

Schema v5 keeps four different concepts explicit. **State** is per-run data and reducer metadata. A **Checkpointer** persists/resumes a thread and its durable-thread requirement. A **Store** is cross-thread knowledge availability; a Step receives a Store `R` or `W` marker only when its own `storeAccess` declares that direct access. **Runtime mode** is a graph-level text/voice declaration, not a subgraph override.

Subgraphs inherit State, Checkpointer, and Store from the graph unless they contain an explicit complete override for that capability. The effective source is therefore `graph`, `inherited`, or `overridden`; missing overrides never imply a disabled capability. Backend, namespace, thread-id source, retention, state fields, and reducers are inspector data rather than topology.

`retry` is an internal Step policy. It may record attempts, backoff, retry conditions, or a provider fallback, but it never creates a graph edge, a routing mode, or a topology loop. A loop remains an authored cycle in `edges` and is bounded only by its topology `loopCap`.

## Routing invariants

A valid MVP graph must satisfy all of the following:

- Node and edge IDs are unique.
- Every edge source and target references an existing node.
- The outer graph has exactly one `start` node and at least one `end` node.
- Each subgraph has exactly one internal `start` and one internal `end` node.
- Return loops are derived from graph topology; they are never stored as a separate edge mode.
- Every non-`end` node has either:
  - exactly one outgoing `normal` edge; or
  - one or more labeled `command` edges; or
  - two to five outgoing `conditional` edges, optionally plus one `fallback` edge.
- A node cannot mix normal and routed (`conditional`, `command`, or `fallback`) outgoing edges.
- Conditional and Command edge labels are readable; conditional labels are unique per source node.
- A source node has at most one fallback edge.
- Normal edges do not retain a condition. A fallback is the conditional-routing role with the normalized label `fallback` and no condition. Conditional and Command edges may retain an optional readable condition.
- Outer `end` nodes have no outgoing edges. An internal `end` has exactly one normal exit edge outside its subgraph; an internal `start` has exactly one incoming entry edge from outside its subgraph.
- Edges may enter a subgraph only through its internal `start`, and may leave only through its internal `end`. Stored endpoints remain the underlying node IDs when a subgraph is collapsed.
- Nodes intended for the final contract must be reachable from `start`.
- Embedded HITL is allowed only on `step` nodes.
- `send` is a strict map relationship; a Merge is a first-class structural node and neither is a Step modifier.
- Direct Store read or write requires Store availability in the Step's effective graph/subgraph scope. It never implies an edge or a Store badge on sibling Steps.
- A Retry policy never satisfies, creates, or visually represents a topology loop.

The editor may allow temporarily incomplete draft states while a person is editing, but a graph cannot be frozen, exported as a contract, or used for scenario generation unless it passes final validation.

## Proposals

```ts
type GraphOperation =
  | {
      type: "add_node";
      node: GraphNode;
    }
  | {
      type: "update_node";
      nodeId: string;
      patch: Partial<Omit<GraphNode, "id" | "parentId">>;
    }
  | {
      type: "remove_node";
      nodeId: string;
    }
  | {
      type: "add_subgraph";
      subgraph: GraphSubgraph;
    }
  | {
      type: "update_subgraph";
      subgraphId: string;
      patch: Partial<Omit<GraphSubgraph, "id">>;
    }
  | {
      type: "assign_nodes_to_subgraph";
      subgraphId: string;
      nodeIds: string[];
    }
  | {
      type: "remove_nodes_from_subgraph";
      nodeIds: string[];
    }
  | {
      type: "dissolve_subgraph";
      subgraphId: string;
    }
  | {
      type: "add_edge";
      edge: GraphEdge;
    }
  | {
      type: "update_edge";
      edgeId: string;
      patch: Partial<Omit<GraphEdge, "id">>;
    }
  | {
      type: "remove_edge";
      edgeId: string;
    }
  | { type: "update_graph_capabilities"; patch: Partial<GraphCapabilities> }
  | { type: "set_subgraph_capability_override"; subgraphId: string; override: Partial<Pick<GraphCapabilities, "state" | "checkpointer" | "store">> }
  | { type: "remove_subgraph_capability_override"; subgraphId: string; capability: "state" | "checkpointer" | "store" };

type GraphProposal = {
  id: string;
  baseGraphId: string;
  baseUpdatedAt: string;
  operations: GraphOperation[];
  rationale: string;
  status: "pending" | "approved" | "rejected" | "invalid" | "stale";
  createdAt: string;
  validationErrors?: ValidationIssue[];
};

type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};
```

Proposal operations are evaluated in their supplied order against a copy of the current accepted graph, with each referenced node or subgraph required to exist at that point in the sequence. `add_node.parentId` is validated against that progressive graph; membership changes never use `update_node`. Assigning or removing a parent preserves a node's absolute screen position, while dissolving a subgraph removes only the container, preserves canonical edges, and converts its direct children to absolute positions. A proposal is valid only if the resulting graph satisfies final validation. Approval applies all operations atomically; failure leaves the accepted graph unchanged.

Durability operations follow the same progressive, review-only path. A proposal can replace graph capability records, set or remove one supported subgraph override, and update a Step's direct Store access or Retry policy. It cannot approve, reject, freeze, resume, create runtime instances, or mutate accepted state while under review.

A proposal becomes `stale` if the accepted graph changes after the agent read it or after the proposal was created. Stale proposals must not be approved without being regenerated against the current graph.

## Generated scenarios

```ts
type BranchCondition = {
  nodeId: string;
  nodeLabel: string;
  edgeId: string;
  label: string;
  condition?: string;
  isFallback?: boolean;
};

type BranchScenario = {
  id: string;
  name: string;
  triggeringConditions: BranchCondition[];
  orderedPath: string[];
  expectedNodes: string[];
  expectedTerminalNode: string;
};

type ScenarioBundle = {
  graphId: string;
  graphName: string;
  graphUpdatedAt: string;
  generatedAt: string;
  scenarios: BranchScenario[];
};
```

Scenarios are generated only from a frozen, valid graph. Each scenario represents one bounded deterministic reachable `start`-to-`end` execution path. A topology-derived return loop is traversed at most once per path, so a graph with a single unbranched path produces one scenario. Retry and provider fallback metadata remains attached to a Step and does not add a scenario traversal.

## WebMCP tools

Tools are registered in the browser using the current imperative WebMCP API shape:

```ts
document.modelContext.registerTool(/* tool definition */);
```

The implementation validates every input and serializes results as structured, agent-readable data.

### `get_graph`

Returns the current accepted graph and its validation or freeze state.

```ts
type GetGraphInput = {};

type GetGraphOutput = {
  graph: WorkflowGraph;
  validation: {
    validForFreeze: boolean;
    issues: ValidationIssue[];
  };
  pendingProposal?: Pick<
    GraphProposal,
    "id" | "status" | "rationale" | "createdAt"
  >;
};
```

Behavior:

- Returns accepted graph only; it never returns a proposal as if it were accepted state.
- The agent may call it in draft or frozen state.
- The returned `updatedAt` value is used to detect stale proposals.

### `propose_graph_changes`

Submits one structured, reviewable proposal. It does not apply changes.

```ts
type ProposeGraphChangesInput = {
  operations: GraphOperation[];
  rationale: string;
  expectedGraphUpdatedAt?: string;
};

type ProposeGraphChangesOutput = {
  proposal: GraphProposal;
  diff: {
    addedNodeIds: string[];
    updatedNodeIds: string[];
    removedNodeIds: string[];
    addedSubgraphIds: string[];
    updatedSubgraphIds: string[];
    removedSubgraphIds: string[];
    membershipChangedNodeIds: string[];
    addedEdgeIds: string[];
    updatedEdgeIds: string[];
    removedEdgeIds: string[];
  };
};
```

Behavior:

- Rejects empty operations or missing rationale.
- Rejects if there is already a pending proposal.
- Rejects when supplied `expectedGraphUpdatedAt` differs from the accepted graph's `updatedAt`; it remains optional for compatible existing clients.
- Validates operations and the resulting proposed graph.
- Returns an `invalid` proposal with issues when the proposed result violates invariants.
- Never mutates the accepted graph.
- Never marks any proposal approved, rejected, saved, or frozen.

### `get_branch_scenarios`

Returns bounded deterministic branch scenarios for the accepted frozen graph; each topology-derived loop is traversed at most once per path.

```ts
type GetBranchScenariosInput = {};

type GetBranchScenariosOutput = {
  graphId: string;
  scenarios: BranchScenario[];
};
```

Behavior:

- Requires a frozen, valid graph.
- Returns an error such as `GRAPH_NOT_FROZEN` when the graph is still editable.
- Returns `GRAPH_INVALID` with validation issues if final validation fails.
- Never freezes the graph, saves state, or generates a human-visible download by itself.

## Human-only actions

The following operations are UI-only and must not be registered as WebMCP tools:

```ts
approveProposal(proposalId: string): void;
rejectProposal(proposalId: string): void;
freezeGraph(): void;
unfreezeGraph(): void; // optional, if later implemented
saveGraph(): void;
exportDownloads(): void;
```

The app must enforce that only an explicit human interaction can approve or reject a proposal and freeze the accepted graph.

## Error behavior

All tools should return predictable structured errors. Suggested codes:

```ts
type ContractErrorCode =
  | "INVALID_INPUT"
  | "GRAPH_INVALID"
  | "GRAPH_NOT_FROZEN"
  | "GRAPH_FROZEN"
  | "PENDING_PROPOSAL_EXISTS"
  | "PROPOSAL_STALE"
  | "PROPOSAL_INVALID"
  | "OPERATION_NOT_FOUND"
  | "OPERATION_CONFLICT";
```

Errors must state what failed and, where relevant, include validation issues. Tool failures must never partially mutate accepted graph state.
