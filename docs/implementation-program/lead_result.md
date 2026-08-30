# Lead result — Graph Library and source attribution

## Outcome

The Graph Library phase is complete and awaiting owner acceptance. GraphContract now provides one responsive, searchable drawer containing exactly ten original schema-v6 workflow templates. Each template is an evidence-informed normalization with a graph-derived topology thumbnail, practical outcome, concepts, complexity, correct GitHub inspiration link, verified durability records where supported, deferred-concept note, and the visible disclaimer `Normalized — no source code copied`.

Opening a library entry stays inside the existing human UI authority boundary: a non-empty graph requires confirmation, Cancel is inert, Open is one-step undoable, persistence and Fit use the ordinary workspace store, and frozen or pending-proposal states block replacement. Library browsing is not exposed through WebMCP, which remains exactly three review-only tools.

## Delivered commits

- **Typed registry contract:** `363b4af`
- **Guarded application/store loading boundary:** `f265092`
- **Top-level ten-entry control:** `fb6e742`
- **Responsive searchable drawer and thumbnails:** `15ffb52`
- **Ten evidence-backed template registry (originally delivered in schema v5 and subsequently migrated to schema v6):** `763a509`
- **Workspace integration, confirmation, Fit, and transient cleanup:** `e205e75`
- **Nested thumbnail geometry and visible source notes:** `b62a0a3`
- **Manual owner review checklist:** `4eb686d`
- **Graph Library Playwright journeys:** `0f6e416`

Per the frozen phase contract, delivery used direct clean commits and non-overlapping embedded workers. Gastown, lead-schedule, Beads, shared Dolt, and scheduler state were not initialized, read, or changed.

## Architecture and behavior

- Library metadata lives in a typed application registry, outside the canonical graph domain and WebMCP authority surface.
- Registry fixtures stay immutable inputs; opening an entry gives the workspace a private graph clone.
- Registry validation rejects the wrong entry count, duplicate IDs, unsafe/noncanonical source URLs, invalid graphs, and templates with no deterministic scenarios.
- All ten entries use the active schema version `6`, validate through `validateGraph`, enumerate scenarios through the ordinary service, and round-trip through graph export and workspace migration. State, Checkpointer, Store, runtime mode, direct Store access, Retry, provenance, and non-native system relationships remain semantically distinct from executable topology.
- The drawer is a controlled presentation component. Search/filter/source-link behavior cannot mutate the accepted graph.
- The application service remains the final authority for replacement. The Zustand action records one history snapshot, clears selection, clipboard and stale runtime projection, and increments the existing Fit revision only after a successful load.
- Loaded identity is derived from the canonical graph ID, so it survives persistence without adding a new account, backend, database, or graph schema field.
- Existing dedicated demos remain available because they still support Package 1–3 regression journeys that are not exact replacements for the normalized library entries.

## Acceptance evidence

- Focused integrated Vitest: **6 files / 52 tests passed**.
- Full Vitest: **24 files / 158 tests passed**.
- Focused Graph Library Chromium: **6/6 passed**.
- Full cold Chromium: **57/57 passed** in 2.6 minutes, retaining all prior 51 journeys.
- Browser guard: no unexpected page-console warnings, page-console errors, or page errors.
- Playwright inventory: zero `skip`, `fixme`, or `only` cases.
- ESLint: passed without warnings.
- Production build: passed. Vinext emitted only its existing plugin-timing, chunk-size, and static route-classification advisories.
- `git diff --check`: passed.

## Manual review and stop gate

The owner checklist is `docs/implementation-program/manual-review-graph-library.md`.

No Package 5 provenance/system-boundary work, scenario highlighting, proposal-comparison redesign, landing/deployment work, or competition-submission work was started. The competition-closure phase remains locked until the owner accepts this library phase and explicitly releases the next gate.
