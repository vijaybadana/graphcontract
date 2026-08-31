# GraphContract Final Visual Acceptance

Date: 2026-08-31

Scope: desktop production build at 1680 × 941, covering the default workspace, Graph Library, a complex subgraph, inspector, frozen scenarios, runtime projection, WebMCP proposal review, and HITL preview. No source changes were made during this audit.

## Overall verdict

The product is functionally strong and the principal flows work without browser console warnings or errors. It is not yet visually ready for the final demo. The approved reference is more legible because it gives the graph substantially more space, uses larger nodes, and makes the selected subgraph the visual focus. The current build compresses complex graphs too aggressively and buries the most important proposal content.

## Captured flow

1. **Default workspace — Needs polish.** The primary controls and taxonomy are understandable, but the Start and Classifier nodes overlap and the header truncates the graph title.
2. **Graph Library — Good.** Search, filters, source attribution, normalization disclosure, and ten templates are coherent. Cards are dense and the lower viewport boundary is abrupt, but the surface is credible.
3. **Complex graph and inspector — Needs work.** Selection and editing work, but opening both panels makes the graph tiny and clips its outer nodes. Edge labels cluster inside the subgraph. Clicking the subgraph body can be intercepted by an edge; clicking its title selects it correctly.
4. **Frozen scenarios — Functionally good, visually dense.** Six deterministic paths appear immediately and downloads are visible. A selected path works, but the graph highlight is too subtle at the current zoom and the scenario card repeats long path text.
5. **Runtime projection — Good.** Three observed worker instances, Merge, and the read-only explanation are easy to understand. The inventory remains scrolled to the demo controls after loading, which makes the left panel look cropped.
6. **Proposal review — Needs work.** Human-only authority is clear and the accepted graph stays locked. The panel initially shows irrelevant graph settings; the actual proposal is below the fold. The Before/Proposed canvases are too small to read, while Approve and Reject require scrolling.
7. **HITL preview — Good.** The reason, timing, three outcomes, resume destinations, preview-only warning, and human-only decision language are clear. This is the most presentation-ready flow.

## Priority fixes before recording the demo

### P0

1. Rework fit/layout for complex graphs when the inspector opens: reserve panel width, re-center, enforce a readable minimum zoom, and avoid clipping outer nodes.
2. Fix the default graph overlap and route-label collisions.
3. Make Proposal mode lead with the proposal: hide or collapse graph settings, auto-focus the review section, keep Approve/Reject visible, and enlarge the changed area instead of rendering two unreadable full-graph thumbnails.
4. Stop the graph title/library control collision in the header at normal desktop widths.

### P1

1. Strengthen selected-scenario contrast and optionally focus the selected path.
2. Reset or intentionally preserve sidebar scroll when switching templates; the current halfway-scrolled inventory looks accidental.
3. Prevent edge hit areas from intercepting a deliberate subgraph-container click.
4. Reduce duplicated path prose and improve small grey text contrast in dense inspector/library regions.

## Accessibility evidence and limits

The captured DOM exposes named controls, tabs, radio groups, status text, and human-response options, and automated keyboard coverage already passes. Screenshot evidence still shows small, low-contrast secondary text and very dense reading regions. This audit does not claim full WCAG compliance; screen-reader order, zoom beyond the tested viewport, and contrast ratios need dedicated measurement.

## Evidence

- `01-default-workspace.png`
- `02-graph-library.png`
- `03-hierarchical-research.png`
- `04-subgraph-inspector.png`
- `05-frozen-scenarios.png`
- `06-selected-scenario.png`
- `07-runtime-projection.png`
- `08-proposal-review.png`
- `09-proposal-comparison.png`
- `10-reference-comparison.png`
- `11-hitl-input-preview.png`

