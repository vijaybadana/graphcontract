# Routing Semantics Lead Plan

Contract: `docs/epics/routing-semantics/design-contract.md` plus the complete source-task implementation envelope dated 2026-08-30
Candidate: `/Users/vijaybadana/graphcontract`, `main`, starting SHA `6439d39`
Strategy: extend the existing edge model once, derive loop presentation from topology, and carry the same semantics through persistence, proposals, projection, inspector, scenarios, exports, and the Research Intake demo without adding router nodes or runtime execution.
Dispatch waves: W1 `RT-M`; W2 `RT-S`, `RT-P`, and `RT-W` after Lead review/integration of `RT-M`; W3 `RT-I` after the domain, projection, and WebMCP interfaces are frozen.
Concurrency: up to three embedded Terra packages at once; W2 packages own non-overlapping seams on the shared candidate, while all graph-domain mutations remain sequential through `RT-M` then `RT-S`.
Scheduling: lead-scheduling pilot; reason: five packages form a material dependency graph with a three-package parallel wave and browser-recovery value.
Reliability lane: guarded; cross-component graph contract and reversible persistence compatibility. Integrated Lead proof is the repository test command plus requested lint/build, followed by real Chromium QA at localhost.
Scenario coverage: ordinary, conditional, Command, fallback, loop, inspector, persistence, freeze, proposals, and downloads → `RT-M`/`RT-S`/`RT-P`/`RT-W`/`RT-I` → focused package checks plus integrated Lead and browser proof.
Architecture conformance: model unchanged; `design-contract.md` grammar → all packages → domain/projection/WebMCP/DOM checks and localhost readback.

Contract preservation:
- Loop is derived, never stored as an edge mode → production path: graph topology projected to canvas/scenarios → prohibited failure: persisted `loop` mode or topology rewrite → packages: `RT-M`, `RT-S`, `RT-P` → proof: domain schema, projection, migration, and cycle-safe scenario checks.
- Existing graphs remain readable → production path: local persistence migration into `WorkflowGraph` → prohibited failure: pre-Command graph parse/load failure or semantic drift → package: `RT-M` → proof: migration-focused check.
- Agent changes remain review-only and atomic → production path: WebMCP proposal schema into progressive candidate validation and human approval → prohibited failure: direct mutation, partial invalid approval, or accepted-graph change on rejection → package: `RT-W` → proof: WebMCP/application focused checks.
- Routing labels and invalidity remain observable → production path: edge validation projected to canvas and inspector → prohibited failure: unlabeled conditional/Command edge appears valid or color-only state → packages: `RT-M`, `RT-P`, `RT-I` → proof: domain, projection, and mounted DOM checks.
- Cycles terminate deterministically → production path: scenario enumeration and export builders → prohibited failure: recursion, nondeterministic output, or lost route semantics → package: `RT-S` → proof: cycle-safe scenario/export checks.

Work packages:
- `RT-M` — canonical Command edge mode, readable-label validation, backwards-compatible migration/defaults, and Research Intake fixture topology; owner: embedded domain engineer; model: gpt-5.6-terra; effort: XHigh; depends on: none
  - Inputs: design contract/image, source envelope, current `WorkflowGraph`/operation schemas, persistence adapter, and sample fixtures.
  - Boundary/isolation: may change domain model, validation, migrations, and canonical fixture only; must not implement canvas styling, inspector UI, or WebMCP JSON schema.
  - Produces/freeze: stable `EdgeMode`/`GraphEdge` contract including `command`, validation codes, migration behavior, and demo fixture.
  - Done/return: focused domain and migration tests pass; no stored loop type; compact commit/result and exact check.
- `RT-S` — deterministic loop-bounded scenario enumeration and export preservation; owner: embedded domain engineer; model: gpt-5.6-terra; effort: High; depends on: `RT-M`
  - Inputs: frozen routing model and existing scenario/export entrypoints.
  - Boundary/isolation: owns scenario traversal and export assertions; loop edges may be traversed at most once per scenario and canonical graph edges must not be rewritten.
  - Produces/freeze: deterministic terminating scenarios that retain route labels/conditions and downloadable reconstruction data.
  - Done/return: focused cycle/scenario/export checks pass; compact result and exact check.
- `RT-P` — reusable React Flow routing-edge component and tokenized visual states; owner: embedded frontend engineer; model: gpt-5.6-terra; effort: XHigh; depends on: `RT-M`
  - Inputs: frozen routing model, design contract/image, existing projection and CSS, installed Phosphor exports.
  - Boundary/isolation: owns canvas projection/native edge rendering and visual tokens only; no external icon libraries/assets and no product-chrome redesign.
  - Produces/freeze: normal, conditional, Command, fallback, derived loop, plus default/hover/selected/invalid/frozen presentations with closed arrowheads and accessible non-color cues.
  - Done/return: focused projection/component check passes; compact result and exact check.
- `RT-W` — Command-capable WebMCP/proposal contract with progressive validation and atomic review; owner: embedded integration engineer; model: gpt-5.6-terra; effort: High; depends on: `RT-M`
  - Inputs: frozen graph/operation schema, current three-tool WebMCP adapter, proposal application path.
  - Boundary/isolation: preserve exactly three tools and human-only approve/reject/freeze; may change tool descriptions, JSON schema, proposal/application tests only.
  - Produces/freeze: external agents can intentionally propose normal, conditional, Command, fallback, and looping topology without direct mutation.
  - Done/return: focused WebMCP/application proposal checks pass, including invalid progressive candidate and rejection immutability.
- `RT-I` — inspector editing, destination/presentation/validation summaries, Research Intake demo loading, and mounted interaction closure; owner: embedded frontend engineer; model: gpt-5.6-terra; effort: XHigh; depends on: `RT-P`, `RT-W`
  - Inputs: frozen routing model/projection/WebMCP contract, existing inspector/workspace locks and demo pattern.
  - Boundary/isolation: owns inspector/workspace/demo/DOM integration; preserve undo/redo, selection/deletion, fit, proposal review, freeze, panels, subgraphs, and unrelated chrome.
  - Produces/freeze: coherent editable/read-only edge inspector and loadable Research Intake workflow demonstrating all semantics/states.
  - Done/return: focused mounted workspace/inspector checks pass; compact result and exact check.

Integration: Lead reviews and commits `RT-M`, then dispatches `RT-S`/`RT-P`/`RT-W`; reconciles routing state and validation at projection/inspector boundaries before `RT-I`; finally runs one integrated repository test command, requested lint/build, and localhost Chromium QA.
Diagnosis: earliest risk is whether current acyclic validation rejects the new derived-loop contract; `RT-M` must make the smallest explicit domain decision while preserving start/end/subgraph constraints, and `RT-S` proves termination.
Research: not needed; the owner-provided contract and installed React Flow/Phosphor interfaces are authoritative.
Escalate only if: completing the outcome requires storing loops as a new edge type, adding router nodes, changing the three-tool/human-approval boundary, or introducing excluded execution/taxonomy features.
