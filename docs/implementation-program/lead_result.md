# Lead result — Package 1 normalized Step system

## Outcome

Package 1 is complete and accepted. GraphContract now stores every work element as one canonical `step`, while Step, Agent, Action, Tool, and Human review remain creation presets with distinct defaults. Legacy graphs migrate deterministically, and the normalized model is preserved across proposals, WebMCP, persistence, undo/redo, scenarios, and exports.

## Delivered packages

- **P1-A — application/state and round trips:** `038ef67`
- **P1-C — canvas and modifier rail:** `69d25e2`
- **P1-W — WebMCP proposal surface:** `101ed74`
- **P1-I — inspector/workspace integration and authority fixes:** `b9a06bc`
- **P1-Q — protected Playwright acceptance library:** `b29a934` through `a9267f9`
- **All-preset drag/drop acceptance:** `71ed54d`

Baseline repairs preceding Package 1 are recorded in `4f61e80`, `b7ca719`, `f658200`, and `b825174`.

## Acceptance evidence

- Vitest: **21 files, 119 tests passed**.
- Playwright: **43/43 Chromium tests passed** on a cold production build; no skipped, fixme, or only cases.
- Focused palette drag/drop: Agent → AI, Action → deterministic, Tool → tool, and Human review → human all create canonical Steps.
- Pending proposal authority: Reset is disabled and inert; accepted graph identity/content and pending proposal rationale/status remain unchanged through `get_graph`.
- ESLint: passed.
- Production build: passed.
- `git diff --check`: passed.
- Unexpected browser console warnings/errors/page errors: none.
- Working tree at accepted candidate `71ed54d`: clean.

## Notable implementation decisions

- Execution ownership is independent from HITL, internal-tool participation, and modifier policies.
- Deterministic execution remains the plain Step baseline rather than a redundant badge.
- Modifier rail shows at most three chips plus an accessible `+N` overflow and focuses stable inspector sections.
- Canvas projection, subgraph containment, and alignment interactions share one node geometry definition.
- Palette click and drag/drop share preset normalization, including the legacy `human_input` transfer alias.
- Accepted-graph mutations, including Reset, remain locked during proposal review.

## Remaining risk and next gate

No material Package 1 regression remains. Vinext still emits its informational unknown-route static-analysis advisory during builds; it is not a browser or product error. Package 2 (HITL, human control, and sensitive effects) must not begin until the owner explicitly releases the next gate.
