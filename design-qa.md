# Design QA — Breakscale-inspired Stage 1 shell

- Source visual truth: `/tmp/graphcontract-breakscale-reference-1280x720.png`
- Browser-rendered implementation: `/tmp/graphcontract-stage1-final-clean-1280x720.png`
- Focused selected-edge state: `/tmp/graphcontract-stage1-selected-edge-1280x720.png`
- Responsive evidence: `/tmp/graphcontract-stage1-820x720-v2.png` and `/tmp/graphcontract-stage1-360x720-v2.png`
- Viewport: 1280 × 720 CSS pixels for the primary comparison; 820 × 720 and 360 × 720 for responsive checks
- Pixel dimensions: source and primary implementation are both 1280 × 720 pixels. CSS viewport and screenshot pixels are 1:1, so no density normalization was required.
- State: white GraphContract editing canvas, inventory open, contextual inspector closed, graph fitted around floating panels. The accepted local graph contains nine nodes and nine branches from the user's preserved browser state.

## Full-view comparison evidence

The reference and implementation were opened together in one comparison input at the same 1280 × 720 viewport. The implementation preserves Breakscale's three floating header islands, compact searchable inventory rail, instruction strip, large continuous canvas, compact bordered Node cards, inline Edge labels, bottom status/counts and bottom-right zoom/fit controls. The dark reference palette is intentionally translated to GraphContract's white canvas and restrained semantic Node colors. Breakscale's product name, simulation copy, metrics, examples, taxonomy and branded assets are not used.

## Focused region comparison evidence

The selected-edge/inspector capture verifies the contextual right panel, compact tab treatment, routing control, destructive action styling and branch-selection state. Additional focused code/render checks verified the selected Edge path uses a 3.2 px blue stroke with a blue drop shadow, matching the strong selected-Node treatment. Separate narrow captures were required because the desktop full view cannot expose responsive overlap and label-fit defects clearly.

## Findings

- No actionable P0, P1 or P2 visual differences remain.
- Fonts and typography: the app retains its existing Geist family and uses compact optical weights, uppercase micro-labels and truncation appropriate to the reference density. No critical wrapping or clipping remains at the checked widths.
- Spacing and layout: floating islands, 16 px desktop margins, compact cards, rail density, status strips and canvas control placement align with the reference composition. Panels overlay the full React Flow viewport, so opening or resizing them never changes graph zoom or position.
- Colors and tokens: the white adaptation uses neutral green-black chrome, light borders/shadows and semantic Node accents with sufficient contrast. Selected Node and Edge states share the same blue focus language.
- Image quality and assets: no raster imagery is required by this product surface. All visible functional icons use the existing Phosphor dependency; no custom SVG, emoji or placeholder imagery was introduced.
- Copy and content: GraphContract and LangGraph terminology replace Breakscale's simulation language as required. No execution metrics or unsupported runtime claims appear.
- Accessibility: inventory search is labelled and announced, resize separators are keyboard operable, panel controls have accessible labels, inspector views use tab semantics with arrow/Home/End navigation, focus styling is visible and reduced-motion rules are present.

## Primary interactions tested

- Inventory search filtered the six components to the matching Tool row and restored correctly.
- Palette and inspector collapse/expand preserved the exact React Flow viewport matrix.
- Both panel resize gestures changed panel width without changing the graph viewport; double-click reset restored the defaults.
- Manual Fit kept all Nodes clear of the currently visible floating panels.
- Node selection opened the contextual inspector; Node dropdown options opened correctly.
- Edge selection opened Edge routing, produced the strong branch highlight and exposed the Normal/Conditional/Fallback dropdown.
- Shift drag-selected two Nodes and two Edges without a maximum-update-depth or ResizeObserver error.
- Inspector tabs responded to ArrowRight and ArrowLeft and updated `aria-selected`.
- At 820 px, opening the contextual inspector automatically closed the inventory so the two panels did not crowd the canvas.
- At 360 px, header groups compacted without overlap and the inspector remained within the viewport.
- `get_graph()` returned a structured object with `graph`, `ok` and `validation` keys; all three WebMCP tools remained registered.
- Browser warnings/errors after the full interaction sequence: none.

## Comparison history

1. Earlier P2: Fit used the full viewport and could place Nodes underneath the floating inventory/inspector.
   - Fix: `useCoalescedFitView` now accepts current asymmetric pixel padding for visible panels while panel toggles themselves still do not trigger fitting.
   - Post-fix evidence: `/tmp/graphcontract-stage1-fit-1280x720.png` and `/tmp/graphcontract-stage1-selected-edge-fit-1280x720.png` keep the fitted graph inside the visible canvas region.
2. Earlier P2: at 820 px, the inventory and contextual inspector could remain open together and leave almost no usable canvas.
   - Fix: compact-width panel opening now closes the opposite panel; responsive widths are bounded independently by their own CSS variables.
   - Post-fix evidence: `/tmp/graphcontract-stage1-820x720-v2.png` shows one contextual panel and usable canvas.
3. Earlier P1: the 360 px header's structural selectors did not hide the intended command groups, causing icon overlap.
   - Fix: header groups/dividers now have explicit semantic classes; panel controls hide at 880 px and history/edit controls hide at 520 px.
   - Post-fix evidence: `/tmp/graphcontract-stage1-360x720-v2.png` shows a non-overlapping GC, Fit/Reset and Freeze composition.
4. Earlier P2 accessibility gap: inspector view buttons visually behaved as tabs without tab semantics or keyboard navigation.
   - Fix: extracted `InspectorTabs` with tablist/tab/tabpanel relationships, roving tab stops and Arrow/Home/End handling.
   - Post-fix evidence: keyboard verification moved selection between both views and returned it to Edit & review.

## Follow-up polish

- P3: the nine-node preserved user graph necessarily renders smaller than Breakscale's three-node reference when fitted with the inventory open. This is content-driven and the user can zoom, collapse panels or use Fit in the current context.
- P3: the reference's runtime metric bands are intentionally absent until the separately scoped Execution Mode has an honest simulation/trace model.

final result: passed
