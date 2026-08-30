# Package 3 frozen schema — Send, Merge, and runtime projection

Status: implementation contract for Package 3

## Accepted graph v4

Package 3 advances the active `WorkflowGraph` to schema version `4`. Version `3` becomes migration input and must migrate without changing existing topology, labels, positions, policies, or proposal meaning.

### Send/map relationship

`send` is a strict `GraphEdge` mode. The edge `target` is the single canonical worker-template Step; the contract never stores or fabricates worker instances.

```ts
type SendMapConfig = {
  destinationTemplateId: string; // must equal edge.target
  multiplicity: 'dynamic';
  payloadLabel: string;
  mergeNodeId: string;
  payloadSchemaRef?: string;
};
```

`send` is required only for `mode: 'send'` and forbidden on every other edge mode. Send cannot carry a routing condition. Canvas-created connections remain normal until a complete Send configuration is applied atomically.

### Merge junction

`merge` is a first-class node kind, never a Step preset.

```ts
type MergeConfig = {
  reducer: { name: string; aggregateState: string };
  completion: { mode: 'all' | 'any' | 'quorum'; quorum?: number };
  continuation: { mode: 'once' | 'per_batch' };
  waitingForDynamicInputs: true;
};
```

The existing `add_node`, `update_node`, and `remove_node` operations own Merge lifecycle. Step-only fields remain invalid on Merge, and Merge configuration remains invalid on Start, Step, or End.

### Bounded topology loops

`GraphEdge.loopCap?: number` is optional, integer, and bounded to `1..10`. Loop remains derived from topology. Existing loops default to one traversal. A topology cycle containing Send requires an explicit cap; retry modifiers never create loop topology.

## Validation contract

- Send source and destination must be Steps in the same graph/subgraph scope.
- `destinationTemplateId` must equal `edge.target` and resolve to exactly one Step.
- `mergeNodeId` must resolve to a same-scope Merge.
- The destination template must connect directly to that Merge through one normal edge.
- Send cannot mix with normal, conditional, command, or fallback outgoing families.
- Merge must have dynamic Send input, one normal continuation, valid reducer text, and valid completion/quorum configuration.
- Send, its template, and Merge cannot cross a subgraph boundary implicitly.
- A cycle containing Send is invalid without an explicit bounded loop cap.
- Every issue exposes a stable edge/node path usable by canvas and inspector invalid states.

## Scenario and download contract

Scenarios traverse each Send template relationship as one design-time path and record ordered dynamic-send and Merge annotations. `×N` is never expanded into fabricated paths. Loop traversal uses `loopCap ?? 1`. Graph JSON, scenario JSON, and Python skeleton retain payload, dynamic multiplicity, reducer, aggregate state, completion, and continuation metadata.

## Runtime projection contract

Runtime evidence is not part of `WorkflowGraph`, proposals, undo/redo, persistence, freeze state, or downloads.

```ts
type RuntimeProjectionFixture = {
  graphId: string;
  graphUpdatedAt: string;
  instances: Array<{
    id: string;
    sendEdgeId: string;
    templateNodeId: string;
    label?: string;
    ordinal: number;
  }>;
};
```

The fixture is accepted only when graph identity/version match, IDs are unique, and every instance references an existing Send edge and its exact template target. Runtime nodes are read-only projection elements: not draggable, connectable, deletable, persistable, exportable, or addressable by WebMCP operations.

## Authority boundary

WebMCP extends existing node/edge proposal schemas for Merge and Send but remains exactly `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`. It gains no runtime-control or human-authority operation. Pending proposals and frozen graphs retain all existing locks.
