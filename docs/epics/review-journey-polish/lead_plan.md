# Review Journey Polish Lead Plan

Contract: `docs/epics/review-journey-polish/engineering_contract.md` (2026-09-03)
Candidate: `/Users/vijaybadana/graphcontract`, `main`, starting SHA `fc939bb049d3b1fc93a18d65dbb26cf34d313bbd`, preserving the pre-existing dirty working tree
Strategy: Extend the existing mode-panel, proposal-comparison, inspector, and scenario-projection seams with additive behavior only; the live portal and current full-screen baselines remain the sole visual authority.
Dispatch waves: W1 proposal rail and scenario rail packages in parallel; W2 Lead-owned workspace/canvas integration after both component contracts are reviewed; W3 integrated verification and local owner handoff.
Concurrency: Two non-overlapping shared-candidate packages own separate feature directories; the Lead alone owns `graph-workspace`, canvas projection reconciliation, Capabilities-strip removal, integration, and the named runtime.
Scheduling: lead-scheduling; reason: two parallel feature packages feed one shared workspace/projection integration boundary and one acceptance closure.
Scenario coverage: proposal overview/detail/collapse/invalid/removal/direct-selection requirements → P1 + P3 → focused proposal DOM and browser journey; scenario semantics/playback/download/pagination requirements → P2 + P3 → focused scenario DOM and browser journey; hidden Capabilities strip and preserved authority/WebMCP requirements → P3 → workspace/browser and existing authority checks.
Architecture conformance: model unchanged; no domain/schema or tool-surface expansion is authorized.

Contract preservation:
- Accepted graph immutability and human-only proposal actions → production path: existing proposal comparison plus store approve/request/reject transitions → prohibited failure: detail navigation mutates accepted state or exposes actions outside overview → package: P1/P3 → proof: proposal DOM plus production browser journey.
- Exactly three WebMCP tools and unchanged downloads → production path: existing registration and download builders → prohibited failure: review polish changes tool count or payload semantics → package: P3 → proof: existing authority/download regression paths.
- Proposal focus is projection-only → production path: local workspace review selection and React Flow viewport helpers → prohibited failure: focus enters history/persistence or removed ghosts become interactive → package: P3 → proof: workspace DOM/browser state readback.
- Scenario playback is presentation-only and cycle-safe → production path: existing derived scenario ordered path/edges plus ephemeral playback state → prohibited failure: replay changes graph, history, scenarios, or runtime state → package: P2/P3 → proof: scenario DOM and browser state comparison.
- Existing portal visual language remains authoritative → production path: the live portal, current `ModePanelShell`, inspector primitives, scenario rows, buttons, tokens, and full-screen baseline screenshots → prohibited failure: any new visual system or geometry drift in toolbar/canvas/rail/global chrome → package: P1/P2/P3 → proof: in-app browser visual comparison at baseline viewport.

Work packages:
- P1 — Proposal overview/detail composition, ordered change navigation, changed-field presentation, actionable issue rows, focus restoration, and component tests; owner: embedded frontend specialist; model: gpt-5.6-terra; effort: High; depends on: none
  - Inputs: engineering contract; `current-proposal-state.jpg`; live current portal; current proposal comparison, panel, overview, inspector primitives, and tests. Ignore every ImageGen reference.
  - Method: expose stable review-entry descriptors and callbacks from the proposal rail; keep global actions overview-only; reuse current inspector anatomy in a proposal-aware read-only detail component.
  - Boundary/isolation: mutate only `src/features/proposals/**` and proposal-local tests/styles/new files; do not edit workspace, scenario, canvas projection, domain, store, WebMCP, or runtime.
  - Produces/freeze: proposal component contract for overview/detail/change/issue navigation consumed by P3.
  - Done/return: focused proposal component check passes; compact result identifies props/interface and any unresolved workspace dependency.
- P2 — Scenario decision semantics, terminal explanation, replay controller/presentation state, and component tests while retaining accordion, pagination, and downloads; owner: embedded frontend specialist; model: gpt-5.6-terra; effort: High; depends on: none
  - Inputs: engineering contract; `current-classic-workspace.jpg`; live current portal; `BranchScenario`, graph nodes/edges, current ScenarioPanel and scenario-presentation files. Ignore every ImageGen reference.
  - Method: derive human-readable decision rows from canonical traversed edges/source nodes and drive bounded ephemeral playback callbacks/state from the ordered path.
  - Boundary/isolation: mutate only `src/features/scenarios/**` and scenario-local tests/styles/new files; do not edit workspace, proposal, canvas adapter, domain, store, WebMCP, or runtime.
  - Produces/freeze: scenario panel callback/state contract and semantic presentation consumed by P3.
  - Done/return: focused scenario component check passes; compact result identifies props/interface and any unresolved projection dependency.
- P3 — Workspace/canvas integration, proposal focus/framing and dimming, direct candidate selection, removed-ghost behavior, scenario path emphasis/playback projection, Capabilities-strip presentation removal, and acceptance coverage; owner: Lead; exception: shared React Flow selection/viewport state and the two worker interfaces require cross-package reconciliation under one authority owner; boundary: `graph-workspace`, canvas adapter/presentation CSS, workspace tests/e2e, integration, runtime, visual QA; depends on: P1, P2; focused check: selected after integration through `test-execution`.

Integration: Review P1/P2 targeted diffs and focused evidence, freeze their component interfaces, then integrate only through ephemeral workspace state and existing projection options. Preserve accepted store/domain/tool APIs and all unrelated dirty changes.
Diagnosis: Main known risk is React Flow selection feedback causing panel auto-open or persisted selection churn; cheapest decisive experiment is a focused mounted-workspace interaction fixture before changing store/domain state.
Research: not needed; the current React Flow viewport/selection APIs and existing repository abstractions are sufficient.
Escalate only if: an acceptance requirement cannot be represented without changing canonical graph/scenario/proposal schemas, adding WebMCP tools, or weakening human authority.
