# Visual Language Package 1 Lead Plan

Contract: `docs/implementation-program/lead-handover.md` and `docs/design-system/implementation-contract.md` at `3e68f18`
Candidate: `/Users/vijaybadana/graphcontract`, branch `main`, starting SHA `3e68f18`
Strategy: close the post-routing handle defect and the adversarially confirmed routing/persistence authority gaps first, then normalize work nodes to schema v2 before layering application, canvas, inspector, and WebMCP behavior around one canonical Step.
Dispatch waves: W0 `P0-H`; W0b `P0-V` and `P0-M`; W0c `P0-R`; W1 `P1-D`; W2 `P1-A`, `P1-C`, and `P1-W` after domain review/freeze; W3 `P1-I` after all seams integrate; Lead closes the full package and browser gate.
Concurrency: shared-candidate mutation is sequential at overlapping domain/migration and final integration seams; `P0-V` and `P0-M` may run concurrently because their production ownership does not overlap, and W2 packages may run in parallel only with non-overlapping ownership; all implementation uses fresh embedded Terra workers.
Scheduling: lead-scheduling pilot; reason: the baseline closures plus a nine-package dependency graph and three non-overlapping post-schema implementation seams warrant durable dispatch state.
Scenario coverage: subgraph entry/exit without React Flow warnings → `P0-H` → mounted projection proof; self/duplicate topology rejected canonically and source-scoped invalid routes projected → `P0-V` → domain/proposal/WebMCP/projection proof; incomplete drafts reload without sample replacement → `P0-M` → persistence migration proof; route-mode switches normalize incompatible data and bounded-cycle wording remains truthful → `P0-R` → inspector/export/docs proof; legacy Agent/Action/Tool/Human migration and schema-v2 round trip → `P1-D` → domain/migration proof; preset creation, undo/redo, persistence and atomic proposals → `P1-A` → application/store proof; Step anatomy, modifier combinations, overflow and interaction states → `P1-C` → projection/DOM proof; WebMCP normalized Step proposals → `P1-W` → adapter/application proof; inspector editing, keyboard overflow, frozen/proposal coexistence and real journey → `P1-I` → mounted integration/browser proof.
Architecture conformance: canonical graph remains the source of truth; React Flow and modifier overflow are projections only; `P1-D` owns schema/migration conformance and Lead owns final reconciliation.

Contract preservation:
- Canonical subgraph endpoints remain internal Start/End IDs → production path: `projectGraphToCanvas` into `ContractNode` handles → prohibited failure: proxy rewiring or missing-handle warnings → package: `P0-H` → proof: mounted Research Supervisor projection.
- Canonical validation is authoritative for every topology entry path → production path: direct graph mutation, proposal service and WebMCP candidate validation → prohibited failure: a pending/approvable self-edge or duplicate source-target pair → package: `P0-V` → proof: domain, application and adapter regressions.
- Every invalid route remains actionable in the canvas → production path: validation issue paths into projection invalid-state mapping → prohibited failure: source-scoped routing errors without paths or red edge treatment → package: `P0-V` → proof: validation, projection and mounted DOM checks.
- Parseable drafts survive persistence migration even when incomplete → production path: persisted workspace migration into ordinary derived validation UI → prohibited failure: replacing an in-progress graph/subgraph with the sample → package: `P0-M` → proof: draft migration and reload preservation fixtures.
- Route modes own coherent semantic data → production path: migration and inspector mode changes through export → prohibited failure: hidden stale condition/label fields or fallback without normalized semantics → package: `P0-R` → proof: round-trip, inspector-switch and export checks.
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
- `P0-V` — make topology validation canonical and project every routing-invalid state to actionable edges; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P0-H`
  - Inputs: canonical validator, connection policy, proposal service, WebMCP adapter, routing validation paths and canvas edge projection at `4f61e80`.
  - Method: reject self-connections and duplicate source-target pairs in the domain; attach stable edge/source paths to routing issues; expand source-scoped issues over affected projected edges.
  - Boundary/isolation: graph validation, proposal/WebMCP checks, edge projection and focused tests; no schema-v2 Step changes or route-mode inspector work.
  - Produces/freeze: one authority invariant shared by UI, proposals and WebMCP plus complete invalid-edge projection.
  - Done/return: domain/application/adapter/projection/DOM regressions and diff check; accepted graph remains unchanged for invalid proposals.
- `P0-M` — preserve parseable incomplete drafts during workspace migration; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P0-H`
  - Inputs: workspace v3 migration, persistence contract, legacy fixtures and current graph schema at `4f61e80`.
  - Method: separate structural parse/recovery safety from final contract validity; retain parseable drafts and let ordinary validation surface issues; fall back only for unrecoverable/corrupt shapes.
  - Boundary/isolation: persistence migration and reload tests only; no canonical validation or schema-v2 changes.
  - Produces/freeze: draft-preserving migration seam suitable for the later deterministic v1-to-v2 migration.
  - Done/return: incomplete node/edge/subgraph and corrupt-shape fixtures, focused tests and diff check.
- `P0-R` — normalize route-mode data and align authoritative bounded-cycle language; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P0-V`, `P0-M`
  - Inputs: edge schema/operations, inspector mode switching, migrations, exports, scenario UI, `docs/contracts.md` and `docs/architecture.md`.
  - Method: define mode-compatible semantic fields and atomically remove/normalize stale incompatible data on mutation/migration; preserve fallback role semantics; replace stale acyclic/exhaustive claims with Command and bounded deterministic-cycle behavior.
  - Boundary/isolation: routing normalization, inspector/export/migration tests and authoritative wording; no Step schema or broad UI redesign.
  - Produces/freeze: coherent serialized routing semantics and non-contradictory Package 1 reading baseline.
  - Done/return: round-trip, inspector-switch and export regressions plus focused/full validation.
- `P1-D` — define schema v2 canonical Step, presets and modifier contracts with deterministic v1 migration; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `P0-R`
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

Integration: Lead has reviewed and committed `P0-H` at `4f61e80`; reviews `P0-V` and `P0-M` independently, then reconciles `P0-R`; freezes the v2 interface only after all baseline gates; then accepts non-overlapping `P1-A`, `P1-C`, `P1-W` commits before dispatching `P1-I`; final reconciliation checks canonical graph/projection separation, legacy migration meaning, human authority, exports and modifier/diff coexistence.
Diagnosis: confirmed earliest Package 0 failure is missing rendered target/source handles on parented internal Start/End nodes; cheapest decisive proof is a mounted Research Supervisor canvas assertion on projected endpoint handles and zero warning logs.
Research: complete from committed evidence synthesis and boards; no external lookup required.
Escalate only if deterministic legacy migration cannot preserve accepted topology/meaning, or Package 1 requires changing the human-authority or exactly-three-tool contract.

Active correction (2026-08-30): owner adversarial QA against candidate `4f61e80` demonstrated that canonical validation accepted self/duplicate connections rejected by the UI policy, invalid routing issues could lack actionable projection paths, workspace migration replaced parseable incomplete drafts, route-mode changes retained contradictory hidden fields, and authoritative docs/UI still described the now-cyclic bounded scenario system as acyclic/exhaustive. `P0-V`, `P0-M`, and `P0-R` are material prerequisite gates added before `P1-D`; the verified `P0-H` closure remains preserved.
