# Visual Language Package 1 Lead Plan

Contract: `docs/implementation-program/lead-handover.md` and `docs/design-system/implementation-contract.md` at `3e68f18`
Candidate: `/Users/vijaybadana/graphcontract`, branch `main`, starting SHA `3e68f18`
Strategy: close the post-routing subgraph-handle defect first, then normalize work nodes to schema v2 before layering application, canvas, inspector, and WebMCP behavior around one canonical Step.
Dispatch waves: W0 `P0-H`; W1 `P1-D`; W2 `P1-A`, `P1-C`, and `P1-W` after domain review/freeze; W3 `P1-I` after all seams integrate; Lead closes the full package and browser gate.
Concurrency: shared-candidate mutation is sequential at domain/migration and final integration seams; W2 packages may run in parallel only with non-overlapping ownership; all implementation uses fresh embedded Terra workers.
Scheduling: lead-scheduling pilot; reason: the defect closure plus a five-package dependency graph and three non-overlapping post-schema implementation seams warrant durable dispatch state.
Scenario coverage: subgraph entry/exit without React Flow warnings → `P0-H` → mounted projection proof; legacy Agent/Action/Tool/Human migration and schema-v2 round trip → `P1-D` → domain/migration proof; preset creation, undo/redo, persistence and atomic proposals → `P1-A` → application/store proof; Step anatomy, modifier combinations, overflow and interaction states → `P1-C` → projection/DOM proof; WebMCP normalized Step proposals → `P1-W` → adapter/application proof; inspector editing, keyboard overflow, frozen/proposal coexistence and real journey → `P1-I` → mounted integration/browser proof.
Architecture conformance: canonical graph remains the source of truth; React Flow and modifier overflow are projections only; `P1-D` owns schema/migration conformance and Lead owns final reconciliation.

Contract preservation:
- Canonical subgraph endpoints remain internal Start/End IDs → production path: `projectGraphToCanvas` into `ContractNode` handles → prohibited failure: proxy rewiring or missing-handle warnings → package: `P0-H` → proof: mounted Research Supervisor projection.
- One canonical Step with creation presets → production path: persisted graph migration and palette/application creation → prohibited failure: active legacy work-node classes or lost visible meaning → package: `P1-D`/`P1-A` → proof: schema and fixture round trips through the ordinary persistence entrypoint.
- Executor, internal tool participation, HITL, policies and proposal diff are independent → production path: Step validation, application update, projection and inspector → prohibited failure: human-owned conflated with HITL, Tool Step conflated with AI internal tools, Retry rendered as a loop, or semantic chips replaced by diff state → package: `P1-D`/`P1-C`/`P1-I` → proof: canonical combination fixtures through mounted canvas/inspector.
- Human authority and progressive atomic proposals remain unchanged → production path: WebMCP adapter to workspace proposal service and UI-only approve/reject/freeze → prohibited failure: accepted graph partial mutation or authority tool exposure → package: `P1-W`/`P1-A` → proof: exactly-three-tool and progressive proposal tests.
- Modifier rail remains compact and accessible → production path: normal Step render and chip-to-inspector focus → prohibited failure: more than three visible modifiers, inaccessible overflow, or color-only state → package: `P1-C`/`P1-I` → proof: mounted DOM keyboard/accessibility checks.
- Schema-v2 data survives history, persistence and downloads → production path: Zustand persisted workspace, JSON exports and undo/redo → prohibited failure: lossy migration, stale schema writes, or missing normalized fields → package: `P1-D`/`P1-A` → proof: persistence and export round-trip tests.

Work packages:
- `P0-H` — eliminate subgraph entry/exit missing-handle warnings without topology changes; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: Medium; depends on: none
  - Inputs: Research Supervisor fixture, React Flow projection, `ContractNode`, collapsed-proxy tests at `3e68f18`.
  - Method: distinguish outer sentinels from parented internal sentinels at the projected handle seam; add mounted regression coverage for both boundary edges and collapsed proxies.
  - Boundary/isolation: node rendering and focused projection/DOM tests only; no canonical endpoint or migration changes.
  - Produces/freeze: clean Package 0 closure commit and warning-proof handle invariant.
  - Done/return: focused tests, full tests, lint and build pass; exact commit/result and concern.
- `P1-D` — define schema v2 canonical Step, presets and modifier contracts with deterministic v1 migration; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `P0-H`
  - Inputs: Package 1 contract, Step board, current domain/proposal schemas, all v1 fixtures and persistence migration.
  - Method: make `step` the only active work kind; retain legacy kinds only in migration input; represent executor and modifier policy summaries independently; migrate every v1 node deterministically while preserving IDs, geometry, membership, topology, HITL, status and timestamps.
  - Boundary/isolation: domain schemas, validation, operations, fixtures and persistence migration/tests; no canvas or inspector implementation.
  - Produces/freeze: reviewed schema-v2 interface and migration invariant for downstream consumers.
  - Done/return: focused domain/migration tests and diff check; stop on any contract distinction that cannot be represented without expanding Package 1.
- `P1-A` — application/state creation presets, history, persistence and export round trips; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P1-D`
  - Inputs: frozen schema-v2 types/migration and current workspace/store/export seams.
  - Method: expose preset-based Step creation and normalized updates through existing authority-safe transitions; preserve undo/redo and serialization.
  - Boundary/isolation: application/state/export tests; no React UI or WebMCP schema edits.
  - Produces/freeze: stable preset/action APIs for UI and adapter packages.
  - Done/return: focused application/store/export checks and exact concern.
- `P1-C` — Step React Flow projection, compact anatomy, semantic modifier rail and palette presets; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `P1-D`
  - Inputs: frozen schema-v2 types, Step board, current node/palette/projection components and visual tokens.
  - Method: one Step shell with executor-led icon/color, at most three semantic chips plus accessible `+N`, and non-color hover/selected/invalid/frozen/proposal states; presets create Step payloads rather than kinds.
  - Boundary/isolation: projection/canvas/palette/CSS/DOM tests; no inspector, workspace service or WebMCP edits.
  - Produces/freeze: reusable Step presentation and accessible modifier metadata.
  - Done/return: focused projection/DOM checks and exact concern.
- `P1-W` — normalized Step proposal and WebMCP surface; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P1-D`
  - Inputs: schema-v2 operation contract and existing exactly-three-tool adapter.
  - Method: update add/update node JSON schema/descriptions and progressive candidate tests for executor/modifier changes without adding authority tools.
  - Boundary/isolation: WebMCP adapter and proposal tests only; exactly three tools remain.
  - Produces/freeze: structured normalized-Step proposal contract.
  - Done/return: focused adapter/application checks and exact concern.
- `P1-I` — inspector/workspace integration and package closure behavior; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `P1-A`, `P1-C`, `P1-W`
  - Inputs: frozen application APIs, Step presentation metadata and WebMCP schema plus current inspector/workspace.
  - Method: executor, participation and modifier-summary sections; chip/overflow focuses the correct inspector section; preserve node/subgraph/edge editing, proposal locks and frozen state.
  - Boundary/isolation: inspector/workspace integration and mounted tests; no Package 2 HITL timing expansion or later policy-detail editors.
  - Produces/freeze: complete user-visible Package 1 candidate.
  - Done/return: focused mounted checks, browser journey where policy permits, exact concern and clean integration candidate.

Integration: Lead reviews and commits `P0-H`; freezes the v2 interface after `P1-D`; then accepts non-overlapping `P1-A`, `P1-C`, `P1-W` commits before dispatching `P1-I`; final reconciliation checks canonical graph/projection separation, legacy migration meaning, human authority, exports and modifier/diff coexistence.
Diagnosis: confirmed earliest Package 0 failure is missing rendered target/source handles on parented internal Start/End nodes; cheapest decisive proof is a mounted Research Supervisor canvas assertion on projected endpoint handles and zero warning logs.
Research: complete from committed evidence synthesis and boards; no external lookup required.
Escalate only if deterministic legacy migration cannot preserve accepted topology/meaning, or Package 1 requires changing the human-authority or exactly-three-tool contract.
