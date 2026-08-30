# GraphContract manual review — Packages 1–3

Use a fresh browser tab at `http://localhost:3000`. If saved state appears, use **Reset example graph** before beginning. Keep DevTools console visible; the complete review should produce no warning, error, page error, or ResizeObserver overlay.

## 1. Canvas authoring and responsive shell

- Add Agent, Action, Tool, Human review, Merge, and Subgraph from the searchable inventory by click and drag/drop.
- Drag nodes and multi-select them; confirm live movement, alignment guides, selection halos, Undo/Redo, Duplicate, Delete, Fit, minimap, zoom, and panel collapse/resize.
- At approximately 1024 px and 390 px widths, confirm the canvas stays usable, panel reopen controls remain obvious, and freeze/unfreeze retains an accessible name.

## 2. Routing and subgraphs

- Select an edge and switch among Normal, Conditional, Command, and Fallback; confirm labels, inspector fields, invalid treatment, and matching selection highlight.
- Load **Research Intake Routing** and verify its visible Command, conditional, fallback, and orange return loop; scenarios remain bounded.
- Load **Research Supervisor**, move/collapse/expand its subgraph, select its boundary/header, and verify child positions plus incoming/outgoing proxy edges restore correctly.

## 3. Normalized Steps

- Confirm Step, Agent, Action, Tool, and Human review create the same Step card anatomy with executor-specific defaults.
- Add several modifiers and confirm the rail shows no more than three plus `+N`; selecting a chip opens the matching inspector section.
- Confirm deterministic Step has no redundant badge, Human ownership is distinct, and Tool execution differs from internal tool participation.

## 4. HITL and human authority

- Load **Human Control & HITL**. Verify accessible gate markers at before/inside/after boundaries and that AI/Tool Steps can carry HITL without becoming Human Steps.
- Open **Preview input request** and try approve, request changes, and reject. Confirm the sheet says preview/non-runtime, Escape and Close work, focus returns, and `get_graph` is unchanged.
- Verify sensitive-effect target, authorization, approval-required, and idempotency are separate fields; removing the required before-approval gate makes the graph invalid.

## 5. Send, Merge, and runtime projection

- Load **Parallel research · Send ×N**. In Design view, confirm exactly one stacked `Search evidence ×N` template, one `Send ×N` relationship, and one first-class Merge—not fabricated workers.
- Select Send and Merge. Verify payload/multiplicity/join plus reducer/aggregate/completion/continuation fields. Blank required fields should show actionable invalid states without losing the draft after reload.
- Switch to Runtime. Confirm exactly three fixture-backed observed instances, read-only inspector identity, disabled editing, and no instance IDs in `get_graph`.
- Switch back to Design. Canonical nodes, edges, positions, and `updatedAt` must be unchanged. After editing the accepted graph, Runtime becomes truthfully unavailable for the stale fixture.

## 6. Scenarios and downloads

- Freeze each valid demo and inspect deterministic scenarios. HITL outcomes and Send/Merge annotations should be visible without fabricated `N` paths.
- For a Send refinement loop, set an explicit loop cap; confirm scenario enumeration terminates deterministically.
- Download `graph-contract.json`, `graph-test-scenarios.json`, and `test_graph_paths.py`. Verify Send payload/multiplicity, Merge reducer/completion, route/loop metadata, and human outcomes are retained; runtime instance IDs are absent.

## 7. WebMCP proposal boundary

- Confirm the page registers exactly `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`, returning structured objects.
- Propose progressive Step/HITL/Subgraph/Send/Merge changes with the current `expectedGraphUpdatedAt`. The accepted graph must remain unchanged while the visual proposal is pending.
- Approve and reject only through the UI. During review, Reset, palette editing, runtime view, and Freeze remain locked. Frozen proposals return `GRAPH_FROZEN`; WebMCP exposes no approve, reject, respond, resume, runtime-control, or freeze authority.

## 8. Persistence and final regression

- Reload an incomplete but parseable draft and verify it is preserved with validation issues rather than replaced by a sample graph.
- Freeze, reload, inspect scenarios/downloads, unfreeze, and confirm ordinary authoring resumes.
- Finish by loading each built-in demo once, checking Fit/minimap and responsive panels, and confirming the browser console remains clean.
