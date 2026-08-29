# Subgraph Foundations Lead Plan

Contract: `docs/epics/subgraph-foundations/engineering_contract.md`
Candidate: `/Users/vijaybadana/graphcontract`, `main`, starting SHA `b054749`
Strategy: Add one canonical subgraph seam from domain through React Flow projection and existing editor controls, preserving stored graph topology while deriving collapsed canvas endpoints.
Dispatch waves: W1 `SG-R` and `SG-D`; W2 `SG-C` after both W1 results are reviewed/integrated; W3 `SG-U` after the canvas interface is frozen; Lead closure/validation after W3.
Concurrency: one read-only research worker may run beside the shared-candidate domain worker; all mutation packages are sequential because they share graph types and the React Flow/store integration seam.
Scheduling: lead-scheduling pilot; reason: four packages form a material research/domain → projection → editor dependency chain with restart/recovery value.
Scenario coverage: SG-1 and SG-5 → `SG-D` + `SG-U` → package-focused tests and Lead localhost proof; SG-2 → `SG-C` → projection tests and Lead localhost proof; SG-3 → `SG-U` → interaction tests and Lead localhost proof; SG-4 → `SG-D` + `SG-U` → fixture tests and Lead localhost proof.
Architecture conformance: approved model delta → `SG-D` owns domain model, architecture/contracts prose, persistence migration, and enforcing tests; final repository validation selected through `test-execution`.

Contract preservation:
- Canonical topology and serialization → production path: Zustand persisted `WorkflowGraph` → migrate/rehydrate → React Flow projection and exports/WebMCP → prohibited failure: missing subgraphs, parent membership, dimensions, coordinates, collapsed state, or legacy load → package: `SG-D` → proof: domain/persistence tests plus Lead reload proof.
- Stored-edge immutability under view collapse → production path: `projectGraphToCanvas` derives visible endpoints from canonical edges → prohibited failure: stored edge mutation, duplication, deletion, or failure to restore endpoints → package: `SG-C` → proof: projection tests against canonical graph before/after collapse.
- Human-only editing authority → production path: UI/store action → framework-free workspace `editable` guard → prohibited failure: any subgraph mutation while frozen or proposal pending, or a new WebMCP authority tool → package: `SG-D` + `SG-U` → proof: workspace tests and exact three-tool browser readback.
- Existing graph behavior → production path: legacy persisted graph/customer-support sample → migration/validation/canvas/freeze/scenarios → prohibited failure: reset, validation, proposal, scenario, download, or ordinary editing regression → package: `SG-D` + `SG-U` → proof: existing focused tests and Lead selected validation.

Work packages:
- `SG-R` — determine the exact supported React Flow v12 grouping, parent/child positioning, hidden-node, edge-endpoint, and keyboard-control constraints; owner: embedded research specialist; model: gpt-5.6-terra; effort: High; depends on: none
  - Inputs: installed `@xyflow/react` v12.11.5 source/types, official React Flow documentation, contract SG-1/SG-2.
  - Method: read-only primary-source inspection; no code/runtime mutation and no third-party tutorial as sole evidence.
  - Boundary/isolation: read-only; no provider/spend/runtime authority; return exact APIs, ordering/coordinate constraints, risks, and smallest validating projection experiment.
  - Produces/freeze: compact research result consumed only after Lead review.
  - Done/return: supported `parentId`/extent/hidden/edge behavior and implementation cautions are explicit; no automated check.
- `SG-D` — add the canonical subgraph domain, migration, guarded workspace operations, scope-aware validation/scenarios, demo fixture, architecture prose, and focused tests; owner: embedded domain engineer; model: gpt-5.6-terra; effort: XHigh; depends on: none
  - Inputs: contract, `src/domain/graph.ts`, `src/application/workspace.ts`, persistence adapter/tests, architecture/contracts docs, starting SHA.
  - Method: first-class `WorkflowGraph.subgraphs` plus durable node `parentId`; legacy persisted graphs normalize to an empty collection; use existing framework-free workspace authority guard.
  - Boundary/isolation: shared-candidate mutation only in domain/application/persistence/docs and their focused tests; do not edit React Flow/features/store; no runtime authority.
  - Produces/freeze: one reviewed commit freezing canonical types, operations, validation semantics, fixture, and migration contract for downstream packages.
  - Done/return: domain/persistence/workspace focused tests pass; compact terminal result with commit SHA.
- `SG-C` — project canonical subgraphs into stable expanded/collapsed React Flow nodes and edges with accessible container rendering; owner: embedded canvas engineer; model: gpt-5.6-terra; effort: XHigh; depends on: `SG-R`, `SG-D`
  - Inputs: integrated canonical domain commit, reviewed React Flow research, projection/component/interaction seams.
  - Method: parent node precedes children; child positions remain relative; collapsed view hides children/internal edges and derives boundary endpoints without mutating edge data.
  - Boundary/isolation: shared-candidate mutation in React Flow adapter, canvas node component/styles, canvas interaction types, and focused projection/geometry tests; do not edit store/palette/inspector/workspace service.
  - Produces/freeze: one reviewed commit freezing the canvas node union and projection contract.
  - Done/return: projection tests cover expanded membership, collapsed incoming/outgoing endpoints, internal-edge survival, and endpoint restoration; compact terminal result.
- `SG-U` — wire subgraph creation/demo loading, selection, inspector label/state/membership editing, guarded movement, dissolve behavior, and accessible controls through the existing store/workspace UI; owner: embedded workspace engineer; model: gpt-5.6-terra; effort: XHigh; depends on: `SG-C`
  - Inputs: integrated domain/canvas interfaces, palette/inspector/store/workspace components, contract SG-1–SG-5.
  - Method: reuse palette and inspector patterns; membership conversion preserves absolute visual position; container movement changes only its canonical position while children retain relative coordinates.
  - Boundary/isolation: shared-candidate mutation in store and feature/workspace UI plus focused tests; no WebMCP tool additions, redesign, public deployment, or runtime lifecycle ownership.
  - Produces/freeze: one reviewed commit completing the user-visible feature path.
  - Done/return: focused component/application checks pass and all controls are disabled when editing is locked; compact terminal result.

Integration: Lead reviews and integrates `SG-D`, then reconciles its types with `SG-R` before dispatching `SG-C`; `SG-C` freezes the canvas union/projection consumed by `SG-U`; Lead owns cross-package repair, preservation closure, exact candidate, browser proof, and final result.
Diagnosis: main uncertainty is React Flow nested-node event/coordinate behavior and collapsed edge projection; `SG-R` resolves it before canvas mutation. Any later failure is classified at canonical model → projection → controlled-state → UI interaction before patching.
Research: `SG-R` uses official React Flow sources only.
Escalate only if: satisfying the feature requires changing the three-tool WebMCP authority boundary, stored-edge schema semantics, acyclic/no-simulation scope, or a protected existing judge journey.
