# Graph Library manual review

Use the local GraphContract workspace at desktop width first, then repeat the responsive checks below.

## Browse and attribution

- Open **Graph library · 10 templates** from the top workspace controls.
- Confirm exactly ten cards appear and each card shows a topology thumbnail, outcome, domain/concepts, complexity, `Inspired by <owner/repository>`, and `Normalized — no source code copied`.
- Search by a title, repository, domain, outcome phrase, and concept. Combine a domain and concept filter, then verify **Clear search and filters** restores all ten entries.
- Open one GitHub source link. It should open the correct repository in a new tab and must not replace the accepted graph.
- Close the drawer with its button and with Escape; keyboard focus should return to the Graph library control.

## Open, restore, and persist

- Choose a template, cancel the replacement confirmation, and verify the current graph is unchanged.
- Open the same template again and confirm. The drawer should close, the graph should fit the canvas, selection/runtime preview should clear, and the opened card should later show **Loaded**.
- Use Undo once and verify the entire prior graph returns. Redo should restore the library graph.
- Reload the page and confirm the loaded or restored graph persists.

## Representative templates

- Open **Hierarchical Deep Research** and verify the expanded Research cell, its internal loop, and readable boundary edges.
- Open **Human-Approved Incident Response** and inspect the approval gate plus Sensitive policy without responding to any real runtime.
- Open **Parallel Research with Reflection** and verify one `Send ×N` template, one Merge, reducer metadata, and the bounded reflection loop.
- Freeze any valid library graph, review its deterministic scenarios, and download the graph/scenario/Python artifacts.

## Authority locks

- While frozen, reopen Graph library. Browsing and source links remain available, but every **Open graph** action explains that unfreezing is required.
- Unfreeze, create a WebMCP proposal, and reopen the library. Replacement remains blocked until the human approves or rejects the proposal.
- Confirm WebMCP still exposes exactly `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`; no library-loading authority is exposed.

## Responsive and accessibility

- At 1440 and 1024 pixels, confirm cards, filters, and close controls remain visible without squeezing the React Flow canvas underneath the drawer.
- At 768 and 390 pixels, confirm the sheet becomes a usable single-column layout and every filter/card/source action is keyboard reachable.
- With reduced motion enabled, confirm drawer/card transitions are removed while focus indicators remain visible.
