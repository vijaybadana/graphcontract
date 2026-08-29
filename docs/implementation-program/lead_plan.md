# Visual Language Package 2 Lead Plan

Contract: `docs/implementation-program/lead-handover.md` Package 2, `docs/design-system/implementation-contract.md` §4, and `docs/design-system/human-control-hitl.png`
Candidate: `/Users/vijaybadana/graphcontract`, branch `main`, starting SHA `746d367`
Strategy: evolve schema v2 to v3 at one reviewed domain seam, then implement canvas/preview UI and WebMCP proposal support in parallel, reconcile authority/persistence at integration, and close against the protected Chromium library.
Dispatch waves: W1 `P2-D`; W2 `P2-U` and `P2-W` in parallel after the schema-v3 seam freezes; W3 `P2-I`; W4 `P2-Q`. Lead owns architecture, progressive integration, final candidate, and owner handoff.
Concurrency: all product mutation uses fresh embedded `gpt-5.6-terra` workers. Only non-overlapping W2 packages run concurrently. Domain, migration, integration, and browser closure remain sequential ownership gates.
Scheduling: Gastown/lead-scheduling; reason: five dependent packages with two safe parallel seams and a protected acceptance boundary.

## Frozen semantic seam

- Active graph schema becomes v3. v2 remains read-only migration input; v1 continues through v2 normalization before v3.
- A human-owned Step remains `kind=step, executor=human`. HITL remains an independent Step modifier and is valid on AI, Tool, deterministic, or human-owned Steps.
- Active HITL timing is exactly `before | inside | after`. Legacy `conditional` timing migrates deterministically to `inside`; its condition is retained as an activation/reason field rather than discarded.
- HITL owns a response contract: `approval | text | selection`, optional selection choices, and one or more allowed outcomes. Every outcome has a stable id, human label, and resume destination node id.
- Resume destinations must correspond to canonical outgoing edges from the gated Step. Scenario enumeration follows those existing edges and annotates the human outcome; it never invents or rewires topology.
- Sensitive-effect policy is independent of HITL and owns target, authorization, approval-required, and idempotency fields. Presence of a policy renders Sensitive; no policy is inferred from executor or HITL.
- When sensitive approval is required, canonical validation requires an enabled `before` approval gate with an allowed `approve` outcome. Editing/proposals never auto-create HITL.
- Preview response/resume is deterministic UI-only state. It may display the configured destination and response payload, but must state that no runtime or accepted graph mutation occurred.
- WebMCP remains exactly three tools. It may propose v3 configuration but cannot approve, respond, resume, freeze, or mutate accepted state.

## Contract preservation

- Package 1 is frozen → active paths: migration, Step presets/modifier rail, proposal authority, downloads and 43-case browser library → prohibited failure: active legacy work kinds, lost modifier distinction, reset/freeze bypass, or weakened acceptance → proof: full regression at `P2-Q`.
- HITL and execution ownership remain orthogonal → path: v3 schema → projection → inspector → prohibited failure: executor changes caused by enabling a gate, or human executor implying HITL → packages: `P2-D`/`P2-U` → proof: canonical combination and DOM fixtures.
- Human outcome topology remains canonical → path: response outcome resume destination → existing outgoing edge → scenario branch → prohibited failure: invented edge, direct runtime mutation, infinite traversal, or non-deterministic ordering → package: `P2-D` → proof: validation/scenario/export snapshots.
- Human authority remains UI-only → path: preview sheet local response/resume → prohibited failure: WebMCP authority tool, accepted graph mutation, frozen/proposal bypass, or false live-run claim → packages: `P2-U`/`P2-W`/`P2-I` → proof: adapter, state, DOM, and browser tests.
- Sensitive approval is explicit → path: policy validation and inspector → prohibited failure: Sensitive silently adds HITL, or approval-required policy validates without an eligible before-approval outcome → packages: `P2-D`/`P2-U` → proof: valid/invalid domain and inspector round trips.
- Persistence remains draft-safe → path: v1/v2/v3 migration and pending proposal restoration → prohibited failure: parseable draft replacement, lost policy/outcome data, or stale proposal mutation → packages: `P2-D`/`P2-W`/`P2-I` → proof: migration/reload/proposal tests.

## Work packages

- `P2-D` — schema v3, migration, validation, deterministic human-outcome scenarios and export truth; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: none
  - Inputs: frozen semantic seam, current domain graph/proposal/scenario model, v1→v2 migration, persistence/export adapters, existing tests.
  - Method: introduce normalized HITL response/outcome and sensitive policy types/schemas; migrate v2 nodes and pending proposals without losing Package 1 meaning; validate timing, selection options, outcome identities/destinations, and approval-required policy; extend cycle-safe scenario conditions with deterministic human outcomes following canonical edges.
  - Boundary: domain, persistence migration, scenarios/exports, and focused tests only; no React UI or WebMCP JSON schema.
  - Done: focused domain/migration/scenario/export tests pass; v1/v2 fixtures restore; schema-v3 interface and validation codes are documented in return; diff check clean.

- `P2-U` — gate projection, inspector policy editor, and deterministic preview sheet; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `P2-D`
  - Inputs: frozen v3 types, HITL board, existing ContractNode/modifier rail/inspector/workspace.
  - Method: render before/inside/after markers at the proper node boundaries with icon, position, accessible label, focus state and reduced-motion treatment; edit complete response/outcome and sensitive policy fields; add `Preview input request` sheet with human-only local response/resume and explicit preview/non-runtime language.
  - Boundary: canvas/inspector/preview components, styles, and DOM tests; no domain, migrations, WebMCP adapter, or scenario algorithm changes.
  - Done: AI+HITL, Tool+HITL, human-owned-without-HITL, all timings, keyboard interaction, frozen/proposal read-only behavior, and preview non-mutation are mounted-test green.

- `P2-W` — schema-v3 WebMCP proposal surface and authority guard; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P2-D`
  - Inputs: frozen v3 graph/operation schemas and existing exactly-three-tool adapter.
  - Method: expose full HITL response/outcome and sensitive-policy shapes in add/update Step operations and descriptions; exercise progressive candidates, invalid policy rejection, stale/frozen/pending protection, and structured get_graph reporting.
  - Boundary: WebMCP adapter/tests and proposal-facing documentation only; no UI or authority action.
  - Done: exactly three tools; no approve/respond/resume/freeze tool; valid proposals remain review-only; invalid candidates do not mutate accepted graph; focused tests pass.

- `P2-I` — application/workspace integration, fixture, persistence and authority reconciliation; owner: embedded Full-stack Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `P2-U`, `P2-W`
  - Inputs: accepted domain, UI, and WebMCP seams plus Package 1 regression suite.
  - Method: reconcile inspector/store updates, undo/redo, proposal preview/diff, reload, freeze/scenarios/downloads, and one compact built-in HITL demonstration with approve/request-changes/reject destinations. Ensure preview state is ephemeral and cleared safely on close/selection/status transitions without changing graph state.
  - Boundary: integration and focused product tests; no Package 3 Send/merge or runtime simulation.
  - Done: focused integrated tests and full Vitest/lint/build pass; clean runnable candidate for browser closure.

- `P2-Q` — protected Package 2 browser acceptance; owner: embedded QA Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `P2-I`
  - Inputs: clean integrated candidate and existing 43-case Playwright library.
  - Method: search and extend existing cases before adding only distinct journeys for all gate timings, AI/Tool plus HITL, preview approve/request-changes/reject without accepted/runtime mutation, sensitive approval validation, and WebMCP/frozen/proposal authority. Run discovery, focused new cases, then full cold suite.
  - Boundary: e2e fixtures/specs and locator alignment only; product failures return to the owning package and tests are never weakened.
  - Done: no skip/fixme/only; all Chromium cases pass with zero unexpected console warning/error/pageerror; full Vitest, lint, build, diff check, and clean tree pass.

## Integration and escalation

Lead reviews and commits every package boundary, keeps one shared candidate, and does not start Package 3. Escalate only if canonical resume destinations cannot be represented without duplicating graph topology, migration would discard authored Package 1 data, or a requested preview behavior would claim actual runtime execution. Otherwise implement the frozen seam and return exact commits/evidence.
