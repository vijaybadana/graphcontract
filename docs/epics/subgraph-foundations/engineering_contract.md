# Subgraph Foundations Engineering Contract

Source: delegated Step 1 brief from task `01a04256-beed-7c80-854b-0101c17f20d7`, 2026-08-29
Lead Executor: Backend Engineer
Candidate: GraphContract `main`

## Accepted outcome

GraphContract supports one first-class, collapsible subgraph container that durably owns child-node membership and layout, renders and edits through the existing React Flow canvas and inspector patterns, preserves stored edge endpoints while collapsed, persists through the existing browser/export/WebMCP paths, and remains immutable whenever the accepted graph is frozen or under proposal review.

## Customer scenarios

- SG-1: Create a subgraph, add two existing nodes, connect them, move the expanded container, collapse, expand, and reload without losing membership, relative positions, dimensions, state, or edges.
- SG-2: Connect one outside node into a child and one child out to an outside node; collapsed rendering terminates cleanly on the subgraph card while stored endpoints remain unchanged and expanded rendering restores the child endpoints.
- SG-3: Select a subgraph and edit its label/collapsed state through the existing inspector; collapse/expand is mouse- and keyboard-accessible and locked during frozen/review modes.
- SG-4: Load the built-in Research Supervisor demonstration with outer Start/End and inner Start → Supervisor → Supervisor Tools → End structure.
- SG-5: Existing saved graphs without subgraphs migrate without data loss, and the existing customer-support sample, WebMCP tools, proposal authority, freeze/scenarios, downloads, and ordinary node editing retain their contracts.

## Change envelope

- Add a canonical `GraphSubgraph` collection to `WorkflowGraph` and durable optional node `parentId` membership.
- Add framework-free workspace operations for subgraph creation, updates, membership changes, movement, dissolve/delete semantics, and loading the new demonstration.
- Extend persistence migration, graph validation/scenario traversal, exports, and WebMCP graph projection without adding a fourth WebMCP tool or exposing human-only controls.
- Extend the React Flow projection with one group/container node type, relative child coordinates, collapsed endpoint projection, and hidden internal edges while collapsed; stored `GraphEdge` values remain canonical and unchanged.
- Extend the existing palette, inspector, and workspace interaction seams only as required for creation, membership, collapse/expand, movement, selection, and demo loading.

## Protected contracts

- React Flow remains the canvas foundation; the canonical domain graph remains the source of truth.
- Exactly three structured WebMCP tools remain registered, and no agent approval/freeze authority is added.
- Collapse/expand never duplicates, deletes, or rewrites stored edges.
- Frozen or proposal-review state blocks every subgraph mutation.
- Existing non-subgraph persisted graphs and the customer-support demo continue to work.
- No command-route or loop styling, worker pools, merge element, simulation, animation, deep-nesting polish, or broad redesign.

## Architecture disposition

Executable architecture delta approved: the domain model, persistence schema, React Flow projection, and editor operations gain one subgraph seam. Repository architecture/contracts prose and the tests enforcing that seam must change together. Deeply nested subgraphs are outside the accepted outcome.

## Acceptance placement

Localhost, owner: Vijay/source-task QA after the Lead returns a candidate-ready result.
