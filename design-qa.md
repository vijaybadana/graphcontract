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

---

## 2026-09-03 addendum — durable Node and Edge hover feedback

- Root cause: a later flat-visual polish deliberately removed Node translation and replaced the earlier Edge stroke/filter response with a very low-opacity halo. That avoided the previous glow, thickness, and hover-jerk defects, but it also made the active hover state effectively invisible on the higher-contrast canvas.
- Ownership boundary: all Node-like shells now use `node-boundary.css` for motion and elevation. The transition is applied to the rendered shell rather than React Flow's positioned wrapper, so layout measurements and canonical coordinates are unchanged.
- Node response: hover lifts ordinary Nodes, Merge, collapsed Subgraphs, runtime instances, and external-system tiles by one pixel and uses a theme-owned shadow token. Expanded Subgraphs strengthen their boundary without translating the group around its children.
- Edge response: the existing React Flow `BaseEdge` interaction path remains the single 28 px hover/click target. Only the visible path and separate halo animate; normal, conditional, Command, fallback, Send, loop, invalid, frozen, and provenance dash patterns remain unchanged.
- Edge weights are restrained: 2.35 px minimum on hover, 2.55 px minimum when selected, 3.2 px hover halo, and 3.8 px selection halo. The prior glow/filter treatment is not restored.
- Reduced-motion users retain the same visual states without transitions or Node translation.
- Focused automated regression coverage: 3 component files / 15 tests passed. The browser regression case now checks real Node hover translation, Edge halo visibility, visible-path weight, and dash-pattern preservation.
- In-app-browser readback after the named-runtime reload confirmed the exact candidate at port 3000, Node transform/shadow transitions, Edge stroke-width transition, React Flow interaction width `28`, and `prefers-reduced-motion: reduce === false`. The in-app automation surface does not expose a pointer-hover primitive, so no external browser was substituted.

final result: passed

---

## 2026-09-03 addendum — collapse-stable workspace chrome

- User comparison: the 1440 × 900 open-rail and collapsed-rail screenshots supplied in the active review.
- Inventory and inspector visibility now affects only the canvas-side insets and the panels themselves. The persistent top header retains the authored 232 px brand track, flexible center track, and 344 px action track in every rail state.
- The GitHub repository badge remains present when the inventory is collapsed, and the Capabilities strip remains centered on the same stable center track.
- React Flow viewport fitting remains revision-driven; rail visibility changes do not request a new fit or rewrite canonical node positions.
- Regression coverage compares the open/open geometry against left-collapsed, right-collapsed, and both-collapsed states at 1440 × 900 and 1920 × 1080.

---

## 2026-09-03 addendum — shared desktop workspace grid

- Visual target: the owner-provided 2880 × 1800 GraphContract screenshot and its explicit three-column alignment contract.
- Browser: Codex in-app browser only, Classic theme, 1440 × 900 viewport, with all four palette/inspector combinations inspected.
- Scope: alignment and responsive positioning only; graph state, WebMCP, modes, labels, colors, and panel content are unchanged.

### Findings and closure

- One stage-owned grid now defines the 16 px outer gutter, 12 px column gutter, 52 px header height, live left rail track, live center canvas track, and live right rail track.
- At 1440 × 900 with both rails open, the brand and inventory are both `x=16`, `width=232`; the status surface and inspector are both `x=1080`, `width=344`; the center toolbar is `x=260`, `width=808`.
- All three header surfaces share `y=16`, `height=52`. Both horizontal column gaps are exactly 12 px.
- The Capabilities strip is centered in the center track with a measured center delta of 0 px in every rail state. Its top edge and both rail top edges are consistently `y=80`, 12 px below the header.
- Collapsing either rail preserves the authored 232 px left header track and 344 px right header track. The center toolbar and Capabilities strip therefore retain their open-state geometry while only the rail and its canvas inset change.
- Measured desktop states (`open/open`, `closed/open`, `open/closed`, `closed/closed`) retain identical header rectangles, equal 12 px gutters, equal 52 px header heights, 0 px Capabilities center error, and 0 px document overflow.
- The large-screen toolbar is no longer capped at an unrelated 820 px width. A focused Playwright bounding-box regression covers 1920 × 1080 and 1440 × 900 across all four rail combinations with a 2 px tolerance.
- Automated verification: focused workspace DOM tests 22/22; ESLint passed; production build passed with only the existing chunk-size advisory; `git diff --check` passed. The Playwright source was added but the CLI browser was not launched because Vijay explicitly constrained visual verification to the Codex in-app browser.

final result: passed

---

## 2026-09-03 addendum — CoS Classic canvas visibility and readable Fit

- Acceptance target: the 10-node Email Triage workflow in Classic mode, with the same shared Node, Edge, Subgraph, and viewport implementation used by draft Design and frozen Scenario views.
- Classic tokens now separate the `#f4f5f3` canvas from white Node surfaces and use a solid neutral node boundary, a restrained `0 2px 8px` separation shadow, semantic accents, and a 2 px selected boundary formed without changing measured geometry.
- Dark remains functionally sound with a near-black navy `#091522` canvas and visibly lighter `#132535` node surfaces. Signal retains its separate green identity.
- Frozen nodes no longer desaturate or fade. Lock/status content communicates frozen state while node ink, boundary, and route semantics remain readable.
- Hover changes paint only. It no longer translates Node or Merge shells, so pointer movement cannot introduce a one-pixel layout jerk.
- Automatic and both visible Fit controls use the shared coalesced fit boundary. Expanded Subgraph containers with visible children are excluded from fit bounds while their children remain targets; hidden nodes are ignored and empty/collapsed groups remain discoverable.
- Desktop automatic Fit is clamped to `0.48`. In the in-app browser, the 10-node Email Triage graph measured `0.48` with both rails open, the inventory collapsed, the inspector collapsed, and both rails collapsed. A normal 220 px node therefore renders at 105.6 px rather than the prior approximately 50 px.
- Browser readback in Classic: canvas token `#f4f5f3`, Node surface `rgb(255, 255, 255)`, selected paint uses a 1 px focus border plus a 1 px inset focus ring, and frozen filter is `none`.
- Browser readback in Dark: canvas token `#091522`, Node surface `rgb(19, 37, 53)`, and frozen filter is `none`.
- Focused layout coverage asserts fit scale `>= 0.47`, rendered node width `>= 100`, and ignores expanded group bounds with visible children. The existing full layout suite remains available for browser execution; per the user's browser constraint, Playwright CLI was not launched in this pass.
- Automated verification: 41 Vitest files / 294 tests passed; ESLint passed; production build passed with only the existing chunk-size advisory; `git diff --check` passed.

final result: passed

---

## 2026-09-03 addendum — CoS flat inspector and global mode panels

- Authoritative presentation contract: `docs/design-system/inspector-flat-design-contract.md`
- Start inspector reference: `docs/design-system/inspector-flat-start-reference.png`
- Mode references: `docs/design-system/mode-panel-scenarios-reference.png`, `docs/design-system/mode-panel-proposal-reference.png`, and `docs/design-system/mode-panel-runtime-reference.png`
- Browser-rendered implementation: `/tmp/graphcontract-inspector-start-current.png`
- Focused comparison: `/tmp/graphcontract-inspector-start-comparison.png`
- Browser: Codex in-app browser only; desktop viewport, Dark theme, editable graph, Start selected.

### Full-view and focused comparison evidence

The source and implementation were placed together in one focused comparison input. The implementation follows the same information architecture while applying GraphContract's active theme tokens: one outer inspector surface; semantic entity icon and actual name; Focus and overflow actions in the header; a single divider; and direct Name, Description, and Parent subgraph fields. Secondary Duplicate/Remove actions remain in the single overflow menu, which is permitted by the contract and avoids duplicating actions already available from the workspace command group.

The global Scenario, Proposal, and Runtime references were inspected alongside their live in-app-browser states. Each top-level mode now owns the right rail directly. The former nested `Edit & review / Scenarios` navigation is absent. Scenario presents deterministic path strips and download actions; Proposal presents the candidate overview, operation summary/diffs, and human-only sticky review footer; Runtime presents truthful read-only fixture context and instance identity.

### Findings and closure

- No actionable P0, P1, or P2 visual mismatch remains.
- Typography: hierarchy, weight, label sizing, and field density follow the references while retaining the existing GraphContract type system.
- Spacing and layout: header, dividers, field rhythm, scroll behavior, and right-rail width are controlled by shared inspector/mode primitives rather than entity-specific one-offs.
- Colors: semantic icon colors and the active Classic/Dark/Signal theme tokens are preserved; the reference's white surface is not hard-coded into Dark mode.
- Assets: all entity visuals reuse the existing Phosphor-backed `NodeVisualIcon` taxonomy. No PNG reference is embedded in production.
- Copy: generic `CONTEXT`, `Inspector`, inner details-card titles, redundant helper paragraphs, and empty `No proposal waiting` content are absent from selected-entity states.
- Accessibility: headers use semantic headings; Focus, overflow, collapse, field, select, modifier, path, proposal, and runtime-instance controls retain accessible names and visible focus treatment; runtime instance selection uses valid list/button semantics.
- Interactions verified in the in-app browser: Start and Agent selection, Focus controls, flat field editing surfaces, freeze-to-Scenario transition, review-only WebMCP proposal auto-opening Proposal, human rejection without accepted-graph mutation, Runtime fixture selection/focus, Undo restoration, and compact 390-pixel mutual panel exclusion.
- Exactly three WebMCP tools remain registered. Browser warning/error output after the complete interaction pass was empty.
- Automated verification: 39 Vitest files / 287 tests pass by full-suite-plus-focused-correction evidence; ESLint passes without warnings; production build passes; `git diff --check` passes.

final result: passed

### Scenario visual-consistency correction

- Shared mode-rail tokens now set 14 px internal padding, a 32 × 32 px mode icon tile, a 16 px glyph, 32 × 32 px header actions, a 15 px mode title, 10 px count/status text, and 38 px minimum interactive rows. Proposal and Runtime reuse the same header tokens; the selected-entity inspector icon intentionally remains 38 × 38 px.
- Inventory and inspector widths remain distinct and unchanged at 232 px and 344 px. Their surfaces continue to share the same theme border, hover, focus-visible, selected, radius, and disabled tokens.
- Scenario rows are divider-separated rather than individually carded. Collapsed paths show the first two chips, `… +N`, and the last two chips. Selecting a row expands that same container in place, wraps the complete chip sequence, and presents Conditions, bounded-loop metadata, and Outcome in compact rows. The former duplicated selected-scenario detail card is removed.
- The visible pagination sentence is replaced by a screen-reader live status and compact page controls when multiple pages exist. The header owns the compact path count.
- Sticky downloads are the three compact, fully labelled actions `JSON`, `Tests`, and `Python`; their original filenames, Blob URLs, and payload generation remain unchanged.
- Wide desktop visual QA passed in both Dark and Classic themes. A 390 × 844 in-app-browser viewport reported `document.scrollWidth === 390`, a 342 px mode rail/header, and no horizontal overflow. Long Path 8 expanded in place with 12 readable chips, two bounded loop traversals, and one expanded details region.
- Browser warnings/errors after the light, dark, wide, compact, collapsed, and expanded passes: none.
- Automated verification: focused mode/scenario DOM tests 6/6; full Vitest 40 files / 291 tests; ESLint passed; production build passed; `git diff --check` passed. Relevant Playwright expectations were updated for the in-place accordion and compact downloads; the CLI browser suite was not launched because this review is constrained to the user's in-app browser.

final result: passed

---

## 2026-09-03 addendum — flat workspace chrome and canonical library layout

- Visual references: the user-provided Dark workspace screenshot and compact GitHub star/link badge.
- Browser: Codex in-app browser only, active desktop viewport.
- Scope: workspace chrome, graph cards/overlays, header control grouping, Graph Library materialization, and removal of the canvas instruction strip.

### Findings and closure

- Workspace, panel, Node, Merge, Subgraph, runtime-instance, Edge-label, preview-sheet, and library-card elevation shadows were removed at their presentation boundaries. Selected, invalid, and focus states retain crisp outlines and borders instead of blurred radiance.
- The left header island now contains only GraphContract identity and a real GitHub repository/star link. Undo, Redo, Duplicate, and Delete share one middle `History and edit controls` group.
- Header icon controls and Auto-layout use accessible CSS tooltips with a 120 ms reveal delay; the delayed native `title` tooltip is no longer used for those actions.
- All Graph Library definitions are passed through the shared deterministic `layoutWorkflowGraph` service during registry materialization. Opening a library entry clones that canonical geometry without a second layout pass.
- The canvas instruction strip is absent in Design, Scenario, Proposal, Runtime, and frozen states. Existing read-only messages remain available in the relevant panel/context UI.
- The in-app browser shows a flat navy Dark workspace with no surrounding card glow, the new GitHub badge, the regrouped middle commands, normalized topology thumbnails, and no instruction strip.
- Full validation: 39 Vitest files / 279 tests passed; ESLint passed; production build passed; `git diff --check` passed.

final result: passed

---

## 2026-09-03 addendum — blueprint-inspired Dark theme

- Directional reference: a local design study reviewed during implementation; it is not shipped with this repository.
- Reference scope: palette and material treatment only; GraphContract layout, identity, semantics, and interactions remain unchanged.
- Reference evidence: the local file's declared `blueprint` Dark tokens use a near-black navy background, blue-slate panels, cool blue borders, pale blue-white text, and cyan/blue interactive accents.
- Browser comparison: the in-app browser blocks `file://` navigation, so the reference was inspected from its authoritative HTML/CSS source rather than rendered through a prohibited workaround. The GraphContract result was rendered and inspected in the in-app browser at the active desktop viewport.

### Findings and closure

- Dark is now visually distinct from Signal: Dark uses navy/slate/blue; Signal retains its green high-contrast identity.
- Body, workspace, stage, and inventory surfaces all report `background-image: none`; no colored boundary gradient remains.
- Rendered Dark readback: app background `rgb(7, 17, 31)`, primary `#2563eb`, focus `#60a5fa`, ink `#edf6ff`.
- Deterministic Step text uses the semantic theme ink token and remains readable on Dark and Signal surfaces.
- Graph topology, node semantics, route colors, status counts, WebMCP behavior, persistence, and scenario generation are unchanged.
- Focused theme/workspace tests: 14 passed. ESLint and production build passed.

final result: passed

---

## 2026-09-03 addendum — stronger canvas and surface hierarchy

- User direction: increase the contrast between the canvas and every authored/floating surface without gradients, radiance, or per-component exceptions.
- The shared Classic canvas token is now `#edf0ed`. Nodes, header islands, inventory, inspector, and global mode rails remain solid white so their boundaries read immediately against the canvas.
- A shared `--gc-panel-surface` / `--gc-panel-border` pair now owns the treatment for header islands, inventory, inspector, and other workspace panels. Classic uses a solid `#bcc6c0` panel boundary; Dark and Signal retain theme-specific equivalents.
- Classic secondary surfaces and the grid were adjusted within the same token layer, keeping the grid quieter than edges and preserving semantic Node/route colors.
- In-app-browser readback confirmed Classic canvas `rgb(237, 240, 237)`, white panels and nodes, `rgb(188, 198, 192)` panel boundaries, and no horizontal overflow at the active 1248 px viewport with both side panels open.
- Dark readback confirmed canvas `rgb(9, 21, 34)`, panel `rgb(15, 28, 43)`, node `rgb(19, 37, 53)`, and a theme-matched translucent blue panel boundary. No green cast or gradient was introduced.
- Automated verification: 41 Vitest files / 294 tests passed; ESLint passed; production build passed with only the existing chunk-size advisory; `git diff --check` passed.

final result: passed
