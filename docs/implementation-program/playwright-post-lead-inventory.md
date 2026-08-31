# Post-Lead Playwright Inventory

Status: complete and verified against Lead checkpoint `59f48d0`.

Target: **22 additive tests in 6 files**, bringing the browser suite from **66 to 88 tests**. Two originally proposed P1 cases were deliberately not duplicated: the existing library suite already freezes and validates every template, while the new geometry suite gives stronger visual coverage than pass-only screenshots.

## Existing baseline — do not recreate

Playwright currently discovers **66 tests in 14 files**:

| Existing spec | Cases | Primary coverage |
| --- | ---: | --- |
| `canvas-authoring.spec.ts` | 4 | Palette creation, drag/drop, multiselect, history |
| `demo-routing.spec.ts` | 1 | Confirmation-protected routing demo |
| `durability-closure.spec.ts` | 5 | State, Checkpoint, Store, Runtime, Retry, WebMCP locks |
| `dynamic-parallelism.spec.ts` | 4 | Send, Merge, bounded loops, presentation modes |
| `edge-editing.spec.ts` | 1 | Edge validation and undo |
| `freeze-persistence.spec.ts` | 1 | Freeze/reload/unfreeze |
| `graph-library.spec.ts` | 7 | Ten templates, filters, source links, load/persist/locks |
| `human-control-hitl.spec.ts` | 4 | HITL timings, response preview, Sensitive policy |
| `provenance-system-boundaries.spec.ts` | 3 | Evidence, opaque boundaries, non-native relationships |
| `responsive-accessibility.spec.ts` | 13 | Breakpoints, keyboard, focus, reduced motion, canvas chrome |
| `routing-details.spec.ts` | 5 | Conditional, fallback, loop and routing edits |
| `scenarios-downloads.spec.ts` | 1 | Native download contents |
| `subgraph-contract.spec.ts` | 5 | Collapse, proxy edges, membership, reset, freeze |
| `webmcp-persistence-scenarios.spec.ts` | 12 | Three tools, proposals, authority, persistence, scenarios |

## P0 — mandatory dashboard acceptance

These are the cases to add after Lead completes. They cover gaps not proven end-to-end by the existing suite.

### `e2e/judge-workflow.spec.ts`

- [x] **J01 — Read, propose, reject:** load a complex library graph; invoke the registered `get_graph` and `propose_graph_changes` tools; open Proposal view; verify accepted truth is unchanged; reject; verify no candidate residue remains.
- [x] **J02 — Repropose, approve, freeze:** submit a corrected proposal; verify Before/Proposed identity-based differences; approve exactly once; freeze; verify scenarios become available.
- [x] **J03 — Scenario and artifact closure:** select one scenario, verify only its path is emphasized, download its artifact, and assert the file describes the same accepted revision and path.
- [x] **J04 — Reload closure:** reload after approval and freeze; verify the accepted graph, revision, status, scenarios, and downloadable artifact remain consistent.

### `e2e/layout-integrity.spec.ts`

- [x] **L01 — All templates avoid node overlap:** load each of the ten templates, wait for layout stabilization, and assert visible node rectangles do not overlap beyond an explicit tolerance.
- [x] **L02 — Subgraph containment:** expanded subgraphs contain their visible members and boundary handles across repeated loads.
- [x] **L03 — Routing legibility:** conditional, Command, fallback, loop, Send, Merge, and proxy edges keep their label pills and painted arrowheads visible after Fit.
- [x] **L04 — Manual placement durability:** drag representative nodes and a subgraph, toggle panels and presentation modes, reload, and verify human-authored positions remain unchanged.
- [x] **L05 — Auto-layout idempotence:** prove the first layout moves a manually displaced element, then verify a second layout does not move elements or change canonical graph semantics.
- [x] **L06 — Collapse/expand geometry:** collapse and expand a complex subgraph containing loops and parallelism; verify proxy routes, membership, selection reconciliation, and Fit remain usable.

### `e2e/final-presentation.spec.ts`

- [x] **V01 — Four-mode projection safety:** switch Design → Runtime → Proposal → Scenario and verify accepted truth plus a real undo/redo history round-trip.
- [x] **V02 — Proposal overview completeness:** additions, updates, removals, membership changes, relationships, and capability changes appear against stable IDs and remain readable at desktop width.
- [x] **V03 — Scenario presentation accuracy:** selecting and changing scenarios highlights the exact native path, dims unrelated elements, and preserves collapsed proxy and non-native relationship semantics.
- [x] **V04 — Presentation accessibility:** exercise the mode radio group using Arrow, Home, and End keys; verify focus, selected state, accessible names, and unclipped 390/768/1024 layouts.

### `e2e/browser-recovery.spec.ts`

- [x] **R01 — Corrupt storage recovery:** seed malformed workspace storage, open the dashboard, and verify a recoverable valid default state with no page error.
- [x] **R02 — Legacy workspace migration:** seed one representative older schema, reload, and verify the migrated graph is editable, valid, and persists in the current schema.
- [x] **R03 — Untrusted scenario recovery:** seed forged scenarios in the current persistence schema and verify they are discarded and deterministically rederived from accepted truth.
- [x] **R04 — Interrupted proposal recovery:** reload with a pending proposal, verify accepted truth remains locked, then reject and confirm normal editing resumes without losing the accepted graph.

## P1 — useful hardening after P0 passes

### `e2e/library-quality.spec.ts`

- [x] **G01 — Source and metadata integrity:** every template has a canonical safe repository URL, stable identifier, domain, concepts, complexity, topology preview, and normalization disclosure.
- [~] **G02 — Covered by baseline:** `graph-library.spec.ts` already loads, validates, freezes, derives scenarios, and reloads every template.
- [~] **G03 — Superseded:** L01–L03 assert actual geometry, containment, route labels, and arrowheads; Playwright retains screenshots only on failure.

### `e2e/interaction-resilience.spec.ts`

- [x] **I01 — Repeated control safety:** repeated Fit, zoom, panel, mode, and selection changes do not mutate accepted truth or history.
- [x] **I02 — Dialog focus restoration:** Graph Library and HITL preview establish/contain focus where supported and restore it to the invoking control.
- [x] **I03 — Download lifecycle:** repeated per-case and all-case downloads create valid, stable artifacts without stale Blob URLs or console/page errors.

## Shared acceptance rules

Apply these to every new case rather than creating separate low-value tests:

- No unexpected `console.error`, `console.warn`, or `pageerror`.
- No fixed sleeps; wait on visible state or a deterministic application signal.
- Prefer roles, accessible names, stable domain IDs, and test helpers over CSS structure.
- Retain trace, screenshot, and video only on failure.
- Do not assert incidental pixel coordinates except in the geometry-focused layout suite.
- Keep human-only authority explicit: WebMCP never approves, rejects, freezes, unfreezes, responds to HITL, or downloads artifacts.

## Verification record

Focused lanes were used only to close failures quickly. Final evidence:

- Playwright discovery: **88 tests in 20 files**, with zero `skip`, `fixme`, `only`, or fixed sleeps in the six added specs.
- Full production Chromium run: **88/88 passed** in 4.6 minutes, one worker, with console warning/error and `pageerror` enforcement in every fixture-backed case.
- Vitest: **35 files / 254 tests passed**.
- ESLint: passed without warnings.
- Production build: passed; only the known Vinext route-classification, plugin-timing, and chunk-size advisories were emitted.
- `git diff --check`: passed.

The suite exposed and closed two real acceptance defects while it was being built:

1. Collapsing a subgraph could leave selection and the inspector attached to an invisible child or internal route; selection now reconciles to the visible parent and React Flow paints the same canonical selection.
2. One pre-existing provenance reload case called `get_graph` before WebMCP tools re-registered; it now waits on the deterministic three-tool registry contract.
