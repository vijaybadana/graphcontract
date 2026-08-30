# Lead result — Package 2 HITL, human control, and sensitive effects

## Outcome

Package 2 is complete and awaiting owner acceptance. GraphContract now models human-in-the-loop gates at `before`, `inside`, and `after` Step boundaries, renders those boundaries accessibly, previews authored input requests without claiming runtime execution, validates sensitive-effect approval policies, and enumerates deterministic branches for configured human outcomes. Human-owned Steps remain distinct from AI- or Tool-owned Steps carrying HITL.

## Delivered packages

- **P2-D — canonical domain, migration, validation, and scenarios:** `005f48d`
- **P2-W — WebMCP proposal schema and authority boundary:** `b2bf5df`
- **P2-U — gate markers, inspector, and preview UI:** `2da3464`
- **P2-I — application/state integration and demo workflow:** `6a93212`
- **P2-Q — protected browser acceptance:** `f2b671f`
- **Preview stacking-context closure:** `c0e509f`

The Gastown plan and package graph were frozen in `a3632d9`. P2-I was manually accepted by the owner after its recorded validation because the run-local scheduler city was only partially initialized and resolved Dolt to `127.0.0.1:0`. Per the owner override, no Beads/Dolt/shared scheduler state was changed or bypassed, and P2-Q continued against the unchanged frozen plan.

## Domain, schema, and migration decisions

- Workspace schema version `3` stores canonical HITL timing, activation, response type, selection choices, allowed outcomes, and resume destinations.
- Sensitive-effect policy is independent data: target, authorization, approval-required, and idempotency. Sensitive does not imply HITL.
- An approval-required sensitive effect validates only when the same Step has an enabled `before` approval gate with an `approve` outcome.
- Legacy conditional HITL migrates deterministically to `inside`; legacy condition text migrates to the activation reason. Existing parseable drafts remain preserved.
- Scenario enumeration branches deterministically over configured human outcomes and retains their route metadata.
- WebMCP can propose the complete configuration through the existing review flow, but exposes no respond, resume, approve, reject, or freeze authority. The surface remains exactly three tools.

## Principal files changed

- Domain and scenarios: `src/domain/graph.ts` and its focused domain tests.
- Migration and persistence: `src/adapters/persistence/migrate-workspace.ts`, persistence middleware and migration tests.
- Application and state: `src/application/workspace.ts`, `src/state/workspace-store.ts`, related tests and fixtures.
- WebMCP: `src/adapters/webmcp/register-tools.ts`, proposal schemas, descriptions, and adapter tests.
- Canvas and inspector: `src/features/canvas/contract-node.tsx`, `src/features/canvas/contract-node.css`, `src/features/inspector/context-inspector.tsx`.
- Human preview: `src/features/hitl/preview-input-request.tsx`, `src/features/hitl/preview-input-request.css`.
- Demo and browser acceptance: palette/workspace wiring and `e2e/human-control-hitl.spec.ts`.

## Acceptance evidence

- Vitest: **21 files, 134 tests passed**.
- Playwright discovery: **47 tests in 10 files**, preserving all 43 Package 1 cases.
- Focused Package 2 Chromium: **4/4 passed** on a cold production build.
- Full cold Chromium: **47/47 passed**; no skipped, fixme, or only cases.
- Browser guard: no unexpected console warnings, console errors, or page errors.
- ESLint: passed without warnings.
- Production build: passed.
- `git diff --check`: passed.

## Browser journeys

- Verified accessible `before`, `inside`, and `after` gate placement, including AI + HITL, Tool + HITL, and the distinct human-owned Step treatment.
- Verified preview-only approve, request-changes, and reject choices without accepted-graph or runtime mutation; the real Close button is pointer-accessible above workspace chrome.
- Verified sensitive approval validation when the required gate is absent.
- Verified exactly three page-registered WebMCP tools, progressive review-only proposals, accepted-graph immutability, and pending/frozen locks.

## Accessibility and performance

- Gate markers have timing-specific accessible names, visible focus treatment, and usable hit areas.
- The modal preview focuses its close control, closes with Escape, restores invoking focus, and is portaled above workspace stacking contexts.
- The preview is explicitly labelled non-runtime and does not write to the accepted graph.
- No new animation or runtime loop was added; browser closure showed no console or ResizeObserver regressions.

## Remaining risk and next gate

No material Package 2 regression remains. Live response execution/resume, simulation, dynamic workers, merge semantics, and runtime traces remain intentionally out of scope. Package 3 must not begin until the owner explicitly accepts this result and releases the next gate.
