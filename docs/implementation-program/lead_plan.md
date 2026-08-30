# GRAPHCONTRACT-FINAL-PHASE Lead Plan

Contract: owner final-phase handover, `docs/implementation-program/lead-handover.md` Packages 4–6, and `docs/design-system/implementation-contract.md` §§6–8
Candidate: `/Users/vijaybadana/graphcontract`, branch `main`, starting SHA `c3c2a96`
Strategy: close deterministic layout first, then advance the canonical schema through separately reviewed durability-v5 and provenance-v6 seams, then add projection-only Scenario/Proposal review views and one integrated acceptance gate.
Dispatch waves: W1 `F1-L`; W2 `F1-U`; W3 `F2-D`; W4 `F2-U` + `F2-W`; W5 `F2-I`; W6 `F3-D`; W7 `F3-U` + `F3-W`; W8 `F3-I`; W9 `F4-S`; W10 `F4-U`; W11 `F-I`; W12 `F-Q`.
Concurrency: only the explicitly paired UI/WebMCP seams in W4 and W7 may run concurrently in the shared candidate; every schema, integration, and acceptance boundary is sequential. Lead owns architecture, diff review, merge decisions, protected authority, and the final candidate.
Scheduling: lead-scheduling/Gastown pilot; reason: fourteen dependent packages, two safe parallel waves, two schema freezes, and material restart-recovery value.
Scenario coverage: layout journeys → `F1-L/F1-U`; durability and Store access → `F2-D/F2-U/F2-W`; evidence/opaque/system relationships → `F3-D/F3-U/F3-W`; scenario highlighting/downloads/proposal comparison → `F4-S/F4-U`; all-ten-template and protected regressions → `F-I/F-Q`.
Architecture conformance: one canonical graph remains authoritative; layout, scenario highlighting, proposal overview, collapsed proxies, runtime instances, and evidence markers remain projections. Schema v4 is F1 input, v5 is the F2 capability schema, and v6 is the F3 evidence/relationship schema.

## Frozen semantic seams

- **F1:** deterministic compound left-to-right layout is an explicit application action. Library load and approved structural replacement invoke it once; ordinary edits and viewport changes never do. Human positions persist afterward. Projection-only loop paths, proxy IDs, runtime instance positions, and highlights never enter the graph.
- **F2 / schema v5:** every graph owns explicit State, Checkpoint, Store, and runtime-mode capability records. Subgraphs optionally override supported records and otherwise inherit. Direct Step Store read/write is valid only when Store is enabled in effective scope. Retry owns optional internal policy metadata and never creates topology.
- **F3 / schema v6:** native control remains `edges`. Spawned-run and external-orchestration relationships live in a separate non-native collection and cannot affect native reachability. Optional evidence attaches to graph elements and relationships; the overlay is a persisted graph capability but its visibility is UI state. Runtime-generated evidence cannot be authored through WebMCP without actual runtime evidence. Opaque Steps expose only declared interface/factory metadata. End nodes gain a semantic outcome normalized from their existing label when migrated.
- **F4:** design-time scenario rows and selected-path highlights are derived from the accepted graph. Official frozen scenarios remain human-generated. Static Send remains `×N`. Per-case/all downloads are human UI only. Proposal view compares the accepted and progressive candidate graphs without creating a second canonical graph.
- Exactly three WebMCP tools remain: `get_graph`, `propose_graph_changes`, `get_branch_scenarios`. Approve/Reject/Freeze/Unfreeze/preview response/download remain human-only.

## Contract preservation

- One canonical graph → production path: domain → application/store → React Flow projection → prohibited: persisted highlight/proxy/runtime/layout-only IDs or duplicated accepted topology → packages `F1-L`, `F4-S`, `F4-U` → proof: projection/state/browser tests.
- Manual layout remains durable → path: library/approval/Auto-layout only → prohibited: panel resize, reload, ordinary edit, or Fit silently rearranges nodes → packages `F1-L`, `F1-U` → proof: deterministic layout/application/Chromium checks.
- State, Checkpoint, and Store remain distinct → path: v5 capabilities → effective scope → header/subgraph/Step inspector → prohibited: generic memory flag/icon, Store R/W without availability, or retry drawn as loop → packages `F2-D`, `F2-U`, `F2-W` → proof: migration/validation/DOM/proposal checks.
- Evidence never strengthens truth silently → path: v6 evidence class + guarded proposal operations + optional overlay → prohibited: untrusted source execution, WebMCP runtime-proof claim, hidden evidence deletion, or invented opaque children → packages `F3-D`, `F3-U`, `F3-W` → proof: domain/adapter/DOM tests.
- Non-native relationships stay non-native → path: separate system relationship collection → projection/export annotations → prohibited: ordinary path enumeration, native validation, or React Flow control arrow treatment → packages `F3-D`, `F3-U` → proof: scenario/export/projection tests.
- Human review authority persists → path: Scenario/Proposal UI → application/store actions → prohibited: WebMCP approval/download, pending/frozen bypass, accepted graph mutation from highlight/overview → packages `F4-S`, `F4-U`, `F-Q` → proof: state/WebMCP/browser journeys.
- Library remains canonical and safe → path: ten registry entries → migration/layout/scenario/export/reload → prohibited: unsafe source link, invalid template, fabricated worker, or lost attribution → packages `F-I`, `F-Q` → proof: all-entry automated journey.

## Work packages

- `F1-L` — deterministic compound layout engine; owner: embedded Frontend Infrastructure Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: none
  - Inputs: schema-v4 graph/subgraph/Send/Merge/loop model, existing `layout-workflow.ts`, canvas dimensions, React Flow projection, Graph Library fixtures.
  - Method: justify and add one focused hierarchical layout dependency; implement deterministic recursive/compound LR layout, ordered branches, subgraph sizing, coherent Send/Merge lanes, and stable loop corridor hints without changing canonical endpoints.
  - Boundary: dependency manifest, layout application module, focused unit tests; no UI controls, schema change, inspector, WebMCP, or full browser run.
  - Produces/freeze: synchronous deterministic layout API returning only canonical node/subgraph geometry; representative linear/branch/nested/Send/loop fixtures pass.

- `F1-U` — Auto-layout action and lifecycle integration; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `F1-L`
  - Inputs: frozen layout API, workspace service/store/header, library load and proposal approval paths, fit-view coalescer.
  - Method: add keyboard-accessible Auto-layout with reduced-motion-safe Fit; invoke layout only after library load or accepted structural replacement; make it undoable and locked during frozen/pending states; preserve manual positions during ordinary edits/reload/panel changes.
  - Boundary: application/state/workspace UI and focused DOM/store tests; no schema or layout algorithm changes.
  - Produces/freeze: accepted F1 behavior and focused Chromium coverage for flagship plus representative topologies.

- `F2-D` — schema-v5 durability capabilities and migration; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F1-U`
  - Inputs: active v4 schemas/migrations/proposals/scenarios, durability board, frozen seam above.
  - Method: define graph capability records, subgraph overrides/effective inheritance, working-state/reducer summaries, checkpointer/durable-thread metadata, Store availability, runtime mode, Step retry policy and Store access validation; migrate v1–v4 deterministically and advance workspace persistence to 6.
  - Boundary: domain, migration, exports/scenarios where metadata is retained, focused tests; no canvas/inspector/WebMCP JSON schema.
  - Produces/freeze: schema v5 and stable validation paths/codes with draft-safe reload.

- `F2-U` — durability projection and inspector; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F2-D`
  - Inputs: v5 types/effective capability service, durability board, current node/subgraph/header/inspector components.
  - Method: graph capability strip; inherited/overridden subgraph cues; State/Checkpoint/Store inspector sections; direct Store R/W and Retry modifier details; semantic zoom, focus, frozen/proposal states.
  - Boundary: React Flow projection/UI/styles/DOM tests only; no domain migration or WebMCP schema.
  - Produces/freeze: accessible v5 canvas and inspector treatment with no generic brain conflation.

- `F2-W` — durability proposal/WebMCP/export surface; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `F2-D`
  - Inputs: frozen v5 schemas and exactly-three-tool adapter.
  - Method: progressive add/update capability, subgraph override, Store access and Retry proposal support; structured validation, persistence/export round trip, stale/frozen/pending protection.
  - Boundary: WebMCP/proposal adapters and focused tests; no UI or authority action.
  - Produces/freeze: review-only complete v5 proposal surface, still exactly three tools.

- `F2-I` — v5 integration and all-template durability closure; owner: embedded Full-stack Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `F2-U`, `F2-W`
  - Inputs: accepted v5 domain/UI/WebMCP seams and ten library entries.
  - Method: reconcile store/history/inspector/proposal/persistence/downloads, update templates to active schema truthfully, run focused integrated checks, and close F2 browser journeys.
  - Boundary: integration corrections only; no F3 evidence semantics.
  - Produces/freeze: clean F2 commit and owner checkpoint.

- `F3-D` — schema-v6 evidence, outcomes, and non-native relationships; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F2-I`
  - Inputs: accepted v5 graph, provenance board, canonical native edge/scenario/export model.
  - Method: add optional element evidence, semantic End outcome, opaque interface metadata, and separate spawned/external relationship records; migrate v5 and earlier, advance persistence to 7, keep native validation/enumeration isolated while exports annotate non-native relationships.
  - Boundary: domain/migrations/scenarios/exports/focused tests; no UI or WebMCP JSON schema.
  - Produces/freeze: schema v6 with stable evidence and relationship invariants.

- `F3-U` — provenance overlay and system-boundary projection; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F3-D`
  - Inputs: frozen v6 types, provenance board, React Flow node/edge projection and inspector.
  - Method: optional numbered evidence overlay/legend; declared/runtime/derived/external treatments; opaque Step interface and evidence-gated Inspect; spawned portal/double-line and external boundary projection; degraded/unimplemented cues; safe evidence inspector.
  - Boundary: projection/UI/styles/DOM tests only; never create native edges or opaque child topology.
  - Produces/freeze: accessible evidence/system-boundary visualization with overlay-off preservation.

- `F3-W` — provenance proposal/WebMCP guard; owner: embedded Backend Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `F3-D`
  - Inputs: frozen v6 schema and progressive proposal adapter.
  - Method: propose evidence, opaque interface, readiness, semantic outcome, and non-native relationship data; reject unsupported runtime-generated proof claims; retain safe untrusted source text/links; preserve exactly-three-tool authority.
  - Boundary: WebMCP/proposal/persistence adapter tests only; no visual projection.
  - Produces/freeze: atomic, review-only v6 proposal surface.

- `F3-I` — v6 integration and library attribution reconciliation; owner: embedded Full-stack Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `F3-U`, `F3-W`
  - Inputs: accepted v6 domain/UI/WebMCP seams and Graph Library source attribution.
  - Method: reconcile safe source rendering, registry migrations, history/persistence, downloads and representative browser journeys without claiming repository/runtime evidence.
  - Boundary: integration corrections only; no F4 scenario/proposal view redesign.
  - Produces/freeze: clean F3 commit and owner checkpoint.

- `F4-S` — scenario projection and per-case artifacts; owner: embedded Backend/Projection Engineer; model: `gpt-5.6-terra`; effort: High; depends on: `F3-I`
  - Inputs: v6 graph/scenario service, React Flow projection, ScenarioPanel and download adapter.
  - Method: derive conditions/path/outcome rows and exact node/edge highlight sets; fade unrelated topology without hiding; retain Send `×N` and non-native annotations; add one-case/all-case human download artifacts.
  - Boundary: derived services/adapters/scenario UI primitives/focused tests; no workspace view switch or proposal overview.
  - Produces/freeze: projection-only scenario selection contract and artifacts.

- `F4-U` — Design/Scenario/Proposal modes and Before/Proposed overview; owner: embedded Frontend Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F4-S`
  - Inputs: scenario highlight seam, existing proposal diff/panel, workspace view controls, review board.
  - Method: add accessible mode switch; scenario selection/highlight lifecycle; proposal overview at fit scale with rationale and changed topology; preserve human-only buttons and frozen/pending locks; responsive/reduced-motion behavior.
  - Boundary: workspace/proposal/scenario UI and DOM tests; no canonical graph or WebMCP authority change.
  - Produces/freeze: complete final review projection.

- `F-I` — final integration across ten templates; owner: embedded Full-stack Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F4-U`
  - Inputs: accepted F1–F4 seams, ten-entry registry, all existing package tests.
  - Method: load → auto-layout → validate → scenario-select → persist/reload every template; reconcile migrations, inspectors, exports, undo/redo, freeze/proposal/download authority, responsive behavior; record final manual checklist/result draft.
  - Boundary: integration fixes and focused checks only; no competition closure, deployment, screenshots, or submission work.
  - Produces/freeze: clean integrated candidate ready for one acceptance run.

- `F-Q` — final protected browser and repository acceptance; owner: embedded QA Engineer; model: `gpt-5.6-terra`; effort: XHigh; depends on: `F-I`
  - Inputs: frozen integrated candidate and existing 57-case Playwright library.
  - Method: extend only distinct final-phase journeys; deeply test flagship/representative graphs and all-ten lifecycle; run full Vitest, warning-free lint, production build, diff-check and one cold Chromium gate with console/page errors fatal.
  - Boundary: e2e/tests/locator alignment and evidence only; product defects return to Lead for bounded correction; no weakened assertions.
  - Produces/freeze: exact counts, clean tree, final result commit and owner handoff.

## Integration and escalation

Lead reviews and commits each scheduler package before resolving it completed. The two schema transitions cannot overlap. F4 may consume but never persist highlights or proposal overview geometry. Escalate only if compound layout cannot preserve canonical subgraph coordinates, capability inheritance requires ambiguous runtime behavior, non-native relationships cannot remain separate from native validation, or proposal comparison would require a second accepted graph. Stop after F-Q; competition closure, submission, deployment, screenshots and demo assets require a new owner gate.
