# Lead result — Package 3 Send, Merge, and runtime projection

## Outcome

Package 3 is complete and awaiting owner acceptance. GraphContract now authors one truthful Send/map relationship to one dynamic worker template, represents Merge as a first-class reducer junction, retains dynamic metadata in bounded deterministic scenarios and downloads, and can show explicit fixture-backed runtime instances as a read-only projection. Design mode never fabricates a worker count, and runtime identity never enters the accepted graph.

## Delivered commits

- **Frozen v4 schema contract:** `4eb8a55`
- **Domain, migration, validation, scenarios, and exports:** `135376f`
- **Incomplete-draft preservation:** `da08af1`
- **Exactly-one-template Send invariant:** `fb02eed`
- **Exactly-three-tool WebMCP proposal surface:** `4b90b9f`
- **Canvas, inspector, application/store, demo, and runtime projection:** `1756013`
- **Integrated lint closure:** `382d6f1`
- **Unit taxonomy regression:** `c47b4e9`
- **Package 3 Playwright acceptance:** `76cf618`
- **Responsive inventory regression:** `9193e26`

Per owner direction, Package 3 used direct clean commits and embedded non-overlapping workers. Gastown, Beads, shared Dolt, and scheduler state were not initialized, read, or changed.

## Domain, schema, and migration decisions

- Active `WorkflowGraph` is schema version `4`; v3 becomes deterministic migration input and Zustand persistence advances to version `5`.
- `send` is a strict `GraphEdge` variant. Its canonical target is one Step template; configuration retains dynamic multiplicity, payload label/schema reference, and the intended Merge.
- `merge` is a first-class node with reducer name, aggregate state, completion policy, continuation policy, and explicit dynamic-input waiting semantics.
- Topology loops remain derived. `loopCap` is valid only on a derived return edge, is bounded to 1–10, and is mandatory when that cycle contains Send. Legacy uncapped loops retain the one-traversal scenario default.
- New text configuration remains schema-parseable while incomplete so ordinary drafts survive reload; `validateGraph` supplies stable, actionable edge/node paths.
- Runtime fixtures bind exact graph identity and revision and remain outside `WorkflowGraph`, proposals, history, persistence, freeze state, exports, and WebMCP operations.

## Principal implementation areas

- Domain and migration: `src/domain/graph.ts`, `src/adapters/persistence/migrate-workspace.ts` and focused tests.
- WebMCP: `src/adapters/webmcp/register-tools.ts` and adapter tests.
- Application/state/demo: `src/application/workspace.ts`, `src/application/package-three-demo.ts`, `src/state/workspace-store.ts`.
- React Flow projection: `src/adapters/react-flow/project-graph.ts` and projection tests.
- Canvas: Send routing treatment, stacked Step template, dedicated Merge and runtime-instance nodes.
- Inspector/workspace: Send/Merge forms, Design/Runtime switch, read-only runtime detail, palette and selection guards.
- Browser acceptance: `e2e/dynamic-parallelism.spec.ts` plus the responsive inventory regression update.

## Acceptance evidence

- Vitest: **22 files, 146 tests passed**.
- Focused Package 3 Chromium: **4/4 passed** on a cold production build.
- Full cold Chromium: **51/51 passed**; no skipped, fixme, or only cases.
- Browser guard: no unexpected console warnings, console errors, or page errors.
- ESLint: passed without warnings.
- Production build: passed.
- `git diff --check`: passed.

## Browser journeys

- Verified Design view shows one `Send ×N` relationship, one stacked worker template, one Merge, and no fabricated runtime nodes.
- Verified Send payload/join and Merge reducer/completion inspection plus visible invalid/freeze-blocked states.
- Verified Runtime is truthfully unavailable without evidence, then shows exactly three fixture-backed read-only instances without changing `get_graph`.
- Verified a progressive WebMCP proposal adds a valid refinement loop with `loopCap: 2`; accepted graph remains unchanged pending human approval.
- Verified human approval, freeze, three deterministic bounded scenarios, and all three downloads retaining Send/Merge/loop metadata while excluding runtime IDs.
- Verified exactly three WebMCP tools and frozen/pending authority locks.

## Accessibility and performance

- Merge and runtime instances are keyboard-selectable and have semantic accessible labels, visible selected/invalid/frozen states, and 32 px or larger controls.
- The Design/Runtime control is a labelled radio group; unavailable Runtime exposes the reason accessibly and on hover.
- Runtime nodes include React Flow handles for warning-free projected connections but remain non-draggable, non-connectable, non-deletable, and non-persisted.
- Runtime layout replaces the design template in its canonical lane and avoids overlapping the Merge without changing accepted positions.
- No execution engine, animation, or fabricated runtime metric was introduced.

## Remaining risk and stop gate

No material Packages 1–3 regression remains. Live trace ingestion, execution/runtime control, simulation, Package 4 State/Checkpoint/Store scope, and later packages remain intentionally deferred. The end-to-end user checklist is `docs/implementation-program/manual-review-packages-1-3.md`. Package 4 must not begin until the user completes portal review and the owner explicitly releases the next gate.
