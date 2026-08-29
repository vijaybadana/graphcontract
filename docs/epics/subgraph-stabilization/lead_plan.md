# Subgraph Stabilization Lead Plan

Execution: Gastown dependency run with Terra embedded workers; Lead owns architecture, reviews every commit, integrates corrections, and performs final repository/browser evidence.

Dispatch waves: W1 `ST-RP` + `ST-RC` read-only in parallel; W2 `ST-P` after proposal research; W3 `ST-I` after canvas research and accepted proposal contract; Lead closure after W3.

## Packages

- `ST-RP` — inspect canonical proposal/application/WebMCP seams and return the minimal operation vocabulary, safe dissolve/reparent semantics, diff model, JSON schema changes, and decisive tests; Terra High; read-only.
- `ST-RC` — inspect React Flow keyboard, stacking, parent/drop, selection/drag, panel-inset behavior, demo replacement, and current lint failures; Terra High; read-only.
- `ST-P` — implement canonical subgraph proposal operations, WebMCP JSON schema, preview/diff/application behavior, and focused end-to-end tests; Terra XHigh; depends on `ST-RP`.
- `ST-I` — implement keyboard activation, inspector reachability, expanded selection/drag surface, visual containment agreement, demo confirmation/Undo, and all scoped lint repairs with mounted/responsive tests; Terra XHigh; depends on `ST-RC` and `ST-P`.

## Frozen boundaries

- Proposal operations remain data-only and execute solely inside existing proposal preview/approval paths.
- `parentId` is canonical membership; projection never silently rewrites stored edges.
- Automatic parenting is accepted only when pointer intent is an expanded subgraph and absolute-to-relative conversion is delegated to existing guarded application operations.
- Panel behavior must not trigger fit/ResizeObserver feedback loops.
- Mutation packages are sequential because graph projection, selection, and workspace wiring overlap.

## Lead evidence

Reuse focused package checks, then select the smallest integrated repository check through `test-execution`; resolve lint and build as named QA requirements without duplicating covered behavior. Browser acceptance is local, non-destructive where possible, at compact and 1440px viewports.
