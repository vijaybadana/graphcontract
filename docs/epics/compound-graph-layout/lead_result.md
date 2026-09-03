# Compound Graph Layout Lead Result

## Accepted outcome

- Replaced the one-level synchronous arranger with an asynchronous ELK compound-layout adapter while retaining React Flow as the renderer and schema-v6 as the only canonical graph.
- Added recursive hierarchy conversion, stable WEST/EAST ports, parent-relative coordinates, deterministic compound bounds, structural caching, explicit authored-geometry preservation, and an explicit Auto-layout dimension-recompute path.
- Centralized React Flow node renderer metadata and routing-edge presentation. Native route mode and loop topology now remain primary across provenance, proposal, scenario, invalid, selected, and frozen overlays.
- Made structural editing schedule one coalesced layout, protected accepted state from stale async results, kept proposal geometry ephemeral, blocked proposal/freeze while accepted geometry settles, and repaired unresolved history snapshots on Undo/Redo.
- Preserved deterministic collapsed proxy topology by grouping and ordering proxies by endpoint and routing semantics without mutating canonical edge endpoints.
- Preserved the finalized **Hierarchical Deep Research** authored geometry, including the `1936 × 1100` Research Supervisor boundary, `1360 × 430` dynamic Researcher group, child-relative coordinates, and final two node positions.
- Kept human-only approval, rejection, request-changes, freeze/unfreeze, WebMCP's existing three-tool surface, scenarios, persistence, runtime projection, and downloads unchanged.

## Commits

- `6963220` — ELK compound graph layout adapter and licence notice.
- `10a121a` — centralized canvas render semantics.
- `b156517` — async layout lifecycle, proposal isolation, proxy determinism, audit closures, and browser acceptance updates.

## Verification

- Focused layout/store suites: 32 tests passed.
- Focused edge resolver/projection/DOM suites: 35 tests passed.
- Full Vitest: 44 files, 322 tests passed.
- Full cold production Chromium: 98 tests passed; zero skipped/fixme/only cases and the repository console/page-error guard remained active.
- ESLint: passed with zero errors.
- Production `vinext build`: passed. The existing informational chunk-size and plugin-timing notices remain.
- `git diff --check`: passed.
- In-app browser: supported local runtime reloaded at `http://127.0.0.1:3000`; the finalized Hierarchical Deep Research graph rendered with both rails, manual Fit kept the full topology between them, stable node/edge handles were present, and browser warning/error logs were empty.

## Review and risk closure

- Independent architecture audit found no P0/P1 issues. Its five P2 findings were closed: authored subgraph dimensions survive collapse/expand, proposal/freeze cannot race accepted layout, unresolved history geometry is re-laid, provenance cannot replace native route styling, and collapsed proxies are insertion-order independent.
- ELK remains an adapter that emits geometry only. It cannot change graph topology, stored endpoints, proposal authority, runtime identity, or persisted projection state.
- The ELK dependency is covered by `THIRD_PARTY_NOTICES.md`; no upstream visual or branded assets were added.

## Handoff

- Local-only delivery; nothing was pushed or deployed.
- The working tree is expected to be clean after this result commit.
- Manual review may begin from the already running local URL. Open **Hierarchical Deep Research**, confirm its large Research Supervisor container and nested Researcher template, then exercise Fit with either rail open, collapse/expand, proposal focus, Scenario focus, freeze/reload, and the three downloads.
