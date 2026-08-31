# GraphContract final integration manual review

Use a fresh tab at `http://localhost:3000` with the browser console visible. Start at 1280×720, then repeat the responsive checks at 1024×768 and 390×844. The review should produce no console warning, console error, page error, or development overlay.

## 1. Canvas and template lifecycle

- Open **Graph library** and confirm all ten normalized templates remain searchable and keyboard reachable.
- Open **Hierarchical Deep Research**, confirm replacement, then verify Auto-layout, Fit, Undo, reload, and the expanded/collapsed subgraph preserve canonical topology.
- Open **Parallel Research with Reflection** and inspect the `Send ×N`, Merge/reducer, bounded reflection loop, and capability strip.
- Confirm Graph Library remains reachable as an icon-only control at 390px.

## 2. Four projection modes

- In a draft, confirm **Design** is active; **Scenario** and **Proposal** explain why they are unavailable; **Runtime** is enabled only when an explicit fixture exists.
- Navigate the segmented control with Arrow keys, Home, and End. Disabled modes must be skipped and focus must stay visible.
- Load the dynamic-parallelism demo, enter **Runtime**, and verify observed instances are read-only and absent from `get_graph()`.
- Return to **Design** and confirm the accepted graph is byte-for-byte unchanged apart from intentional human edits.

## 3. Frozen scenarios and downloads

- Freeze a valid graph and confirm **Scenario** opens automatically.
- Select a scenario. Nodes, native routes, collapsed proxies, and relevant non-native annotations on its path should become active while unrelated topology remains visibly dimmed.
- For a graph with many paths, use Previous/Next scenario pages. Selection and the per-case download controls must remain available across pages.
- Download the selected case as JSON and Python, then download all three contract artifacts. Confirm IDs, ordered path, conditions, outcomes, loop caps, Send/Merge metadata, and relationship annotations are retained.
- Reload the frozen graph. Scenarios must be deterministically rederived from the accepted graph; the local highlight selection should not persist.

## 4. Proposal review and human authority

- Through WebMCP, submit a valid multi-element proposal using the current `expectedGraphUpdatedAt`.
- Confirm **Proposal** opens automatically, the accepted graph stays locked, and the same candidate drives the main canvas, capability strip, inspector, subgraph members, and **Before / Proposed** overview.
- Inspect the semantic summary. It must expose stable IDs plus exact **Before** and **Proposed** values without relying on the inert mini-canvases.
- Reject once and confirm no accepted mutation. Submit again, approve through the UI, and confirm the complete candidate applies atomically.
- Force a stale proposal by reloading a changed accepted revision. Candidate topology must not be replayed; Approve is disabled and Reject remains available.
- While review is pending, Reset, palette editing, Freeze, Runtime, library replacement, and direct accepted-graph mutation must remain locked.

## 5. Persistence, integrity, and responsive closure

- Freeze and reload each library template. Validate, scenario count, downloads, and accepted graph identity must remain deterministic.
- Confirm a parseable incomplete draft reloads with validation issues instead of being replaced.
- At 1280px, click Reset and verify the right authority island does not cover it; Undo must restore the exact prior graph.
- At 1024px, swap the inventory and inspector panels and review a proposal without horizontal page overflow.
- At 390px, freeze, select a scenario, access its downloads, unfreeze, and reopen Graph Library. All controls retain accessible names and at least 32px targets.
- Finish by confirming WebMCP exposes exactly `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`; none can approve, reject, freeze, unfreeze, respond, resume, load a template, or download an artifact.

This checklist closes the frozen F-I/F-Q scope. Competition demo composition, screenshots, deployment, and submission work remain a separate owner-gated phase.
