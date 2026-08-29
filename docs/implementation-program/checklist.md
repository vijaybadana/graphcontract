# Complete visual-language build checklist

## Build preferences

- **Build mode:** Autonomous, package-gated.
- **Comprehension checks:** N/A; written contracts are authoritative and owner review closes each package.
- **Git:** One clean owner-reviewed commit per feature package.
- **Verification:** Automated checks plus real Chromium closure for every package.
- **Check-in cadence:** Ping owner after each committed package; never chain packages across unresolved attention.
- **Wow moment:** A coding agent proposes a complex graph change through WebMCP, the exact topology and human boundaries appear visually, the human reviews/edits/approves it, then GraphContract generates deterministic scenarios.

## Checklist

- [x] **1. Close and baseline routing semantics**
  Spec ref: `docs/epics/routing-semantics/design-contract.md`
  What to build: Finish the active Edge, Conditional, Command, Loop and Fallback package; obtain final owner review and record its commit as the implementation-program baseline.
  Acceptance: Routing visuals, schema, migrations, proposals, scenarios, persistence and downloads are browser-verified; working tree is clean.
  Verify: Full test suite, lint, production build, real Chromium routing journey, `git status --short`.

- [x] **2. Normalize Step semantics and migrations**
  Spec ref: `lead-handover.md > Package 1 — normalized Step and modifier system`
  What to build: Replace incompatible work-node classes with one canonical Step plus presets/modifiers while preserving legacy imports and visible meaning.
  Acceptance: All old fixtures migrate; new Step combinations parse, validate, persist, undo and round-trip through export.
  Verify: Focused domain/migration/application/state tests plus fixture snapshot comparison.

- [x] **3. Build Step component, palette presets and inspector**
  Spec ref: `docs/design-system/implementation-contract.md > Step component anatomy`
  What to build: Implement compact node anatomy, modifier rail/overflow, states, Phosphor icons, palette presets and WebMCP-editable inspector fields.
  Acceptance: Step, Agent, Action, Tool and Human review presets all create the same canonical object; complex modifier combinations remain readable and accessible.
  Verify: DOM/accessibility tests and real Chromium add/edit/overflow/freeze/proposal journey.

- [ ] **4. Implement HITL and sensitive human control**
  Spec ref: `lead-handover.md > Package 2 — HITL, human control and sensitive effects`
  What to build: Add gate timing, response contracts, preview input sheet, sensitive policies and human-outcome scenarios without claiming live runtime execution.
  Acceptance: Human-owned versus HITL is unambiguous; only human UI can respond/resume preview; WebMCP can propose but not exercise authority.
  Verify: Domain/WebMCP/scenario/DOM tests and real Chromium before/inside/after plus approval/change/reject preview.

- [ ] **5. Add Send/map and Merge domain semantics**
  Spec ref: `lead-handover.md > Package 3 — Send/map, merge/reducer and runtime projection`
  What to build: Add strict Send/map control semantics, first-class Merge junction, reducer/completion metadata and cycle-safe path behavior.
  Acceptance: Dynamic multiplicity is retained without fabricated workers; invalid fork/join structures fail with actionable errors.
  Verify: Domain, validation, migration, proposal and deterministic scenario tests.

- [ ] **6. Build parallel design/runtime projections**
  Spec ref: `docs/design-system/implementation-contract.md > Dynamic parallelism and merge`
  What to build: Implement `Send ×N`, stacked worker template, Merge marker, inspector and read-only runtime-instance projection driven only by supplied trace/fixture evidence.
  Acceptance: Switching views never mutates the graph; frozen/proposal/selection states work; downloads retain dynamic annotations.
  Verify: Projection/DOM tests and real Chromium design/runtime/loop-cap journey.

- [ ] **7. Implement State, Checkpoint and Store scope**
  Spec ref: `lead-handover.md > Package 4 — state, checkpoint and Store scope`
  What to build: Add graph/subgraph capability metadata, inheritance, header strip, inspector and Step Store R/W modifiers; distinguish retry policy from loop topology.
  Acceptance: State, Checkpoint and Store remain separate in schema and UI; inheritance and validation are deterministic.
  Verify: Domain/inheritance/migration/WebMCP tests and browser graph/subgraph/Step editing journey.

- [ ] **8. Implement provenance and system-boundary relationships**
  Spec ref: `lead-handover.md > Package 5 — provenance, opaque topology and system boundaries`
  What to build: Add evidence metadata/overlay, opaque topology, spawned-run portals, external-orchestration paths and degraded/unimplemented states.
  Acceptance: The canvas never presents external or inferred behavior as a native edge; hiding the overlay preserves metadata.
  Verify: Validation/projection/scenario/export/DOM tests and browser evidence-overlay/relationship-family journey.

- [ ] **9. Build the ten-template registry**
  Spec ref: `lead-handover.md > Package 6 — ten-template library, scenario highlighting and proposal review`
  What to build: Author ten original normalized fixtures, registry metadata, compact searchable library and topology thumbnails.
  Acceptance: Every template validates, persists, exports/reloads and credits inspiration without copying source code/assets.
  Verify: Per-template validation and scenario snapshots plus browser search/load/replace/undo journey.

- [ ] **10. Complete scenarios and proposal comparison**
  Spec ref: `docs/design-system/implementation-contract.md > Templates, scenarios and proposal review`
  What to build: Add semantic scenario rows, path highlighting, per-case downloads, Design/Scenario/Proposal views and Before/Proposed overview.
  Acceptance: Highlights are projections; all new elements display correct proposal diffs; human authority remains enforced.
  Verify: Scenario/diff/download tests and Chromium highlight/download/approve/reject/freeze journey.

- [ ] **11. Integrated accessibility, performance and regression closure**
  Spec ref: `lead-handover.md > Package 7 — integrated closure and competition demo`
  What to build: Close keyboard navigation, accessible labels, semantic zoom, reduced motion, panel behavior, large-graph performance and regression gaps.
  Acceptance: Flagship complex graph remains usable; zero uncaught console errors; existing behavior is preserved.
  Verify: Full suite, lint, production build, performance observation and complete real Chromium regression matrix.

- [ ] **12. Prepare competition handoff**
  Spec ref: `lead-handover.md > Package 7 — integrated closure and competition demo`
  What to build: Freeze the flagship demo, WebMCP prompt sequence, human-review story, screenshots, downloadable artifacts, README instructions and submission proof points.
  Acceptance: A judge can understand and reproduce the wow moment quickly; all claims match the implemented product.
  Verify: Rehearse the deterministic demo from a clean browser profile and review all submission assets.

## Gate rule

An unchecked item may not be hidden by starting a dependent item. If a package reveals a necessary schema correction, repair and re-close that package before continuing.
