# Playwright regression gate

`npm run test:e2e` is the protected browser acceptance gate for GraphContract.
Run it on every candidate integration after unit tests and before deployment.
The gate builds the exact tree and owns its Vinext production server on
`127.0.0.1:3217`; set `PW_PORT` to avoid a port conflict. It reuses an existing
server only when `PW_REUSE_SERVER=1`.

The initial Chromium suite protects these user-visible contracts:

- destructive demo replacement requires an explicit confirmation;
- Command, conditional, fallback, and topology-derived loop routes remain
  inspectable and editable with visible validation and undo;
- freezing is human-only, locks authoring, persists across reload, and can be
  explicitly reversed;
- the Research Intake fixture produces five deterministic, cycle-bounded paths;
- all three native downloads fire and preserve graph/scenario/loop metadata;
- WebMCP exposes exactly `get_graph`, `propose_graph_changes`, and
  `get_branch_scenarios`; proposals cannot alter the accepted graph before a
  human approves them, and rejection is lossless;
- the 390 px layout keeps the canvas and both side panels reachable without
  document-level horizontal overflow;
- every test fails on an unexpected `pageerror`, `console.error`, or
  `console.warning`, with the collected messages attached to the report.

The WebMCP browser fixture supplies only the browser registration surface
(`document.modelContext.registerTool`). It executes the real page-registered
tool implementations and does not import application stores or bypass the
human approval UI.

## Integration certification

The combined library contains 43 meaningful cases in 9 spec files after
removing cross-branch copies of the compact smoke, authority journey, and
bounded-scenario checks. Distinct mouse, keyboard, persistence, schema,
responsive, routing, subgraph, download, and human-authority invariants remain
separate.

At product base `b9a06bc`, all 43 cases pass against a cold production server
with no unexpected console warnings, console errors, or page errors. This
includes normalized preset click-add and drag/drop, exact compact freeze and
unfreeze names, and the rule that an unresolved proposal disables reset while
the accepted graph and pending proposal remain unchanged. The same certified
tree passes all 119 Vitest cases and lint.

Install the browser once on a new machine with `npx playwright install chromium`.
Use `npm run test:e2e:headed` for interactive diagnosis and
`npm run test:e2e:report` to inspect the last HTML report.
