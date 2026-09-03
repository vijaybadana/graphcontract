# Engineering Handoff Packet — Review Journey Polish

## Status

- Surface: Proposal review and frozen-scenario review in the GraphContract workspace
- Status: Ready for implementation
- Owner: Vijay / acceptance owner
- Date: 2026-09-03
- Source hierarchy:
  1. This engineering contract
  2. The live current GraphContract portal
  3. `current-proposal-state.jpg` and `current-classic-workspace.jpg` as immutable current-UI baselines
  4. Existing GraphContract inspector/mode-panel/proposal/scenario primitives
  5. Existing domain, proposal-comparison, scenario-derivation, and authority contracts
- Inspiration folder: Not applicable; this is an original product interaction derived from the live end-to-end acceptance run.

## Source Evidence

| Source | Path | Purpose | Status |
|---|---|---|---|
| Current proposal baseline | `docs/epics/review-journey-polish/current-proposal-state.jpg` | Immutable source for existing Proposal mode geometry and styling | Authoritative baseline |
| Current scenario baseline | `docs/epics/review-journey-polish/current-classic-workspace.jpg` | Immutable source for existing Scenario mode geometry and styling | Authoritative baseline |
| Existing proposal surface | `src/features/proposals/` | Reuse proposal summary, comparison, actions, and candidate projection | Existing implementation |
| Existing inspector | `src/features/inspector/` | Reuse entity headers, fields, icons, and read-only presentation | Existing implementation |
| Existing scenario surface | `src/features/scenarios/` | Reuse scenario derivation, selection, downloads, and pagination | Existing implementation |
| Existing canvas projection | `src/adapters/react-flow/` and `src/features/canvas/` | Reuse selected-path and proposal projection data | Existing implementation |

## Scope

### In Scope

1. Proposal panel collapse must work and remain collapsed until the user explicitly reopens it.
2. One right rail with two proposal states:
   - Proposal overview with rationale, change list, and global actions.
   - Proposal-aware read-only node/edge inspector.
3. Clicking a change row must, in one action:
   - select the affected candidate element;
   - pan/fit the canvas to it (for an edge, frame both endpoints);
   - dim unrelated elements;
   - emphasize the changed element without relying on color alone;
   - open its proposal-aware inspector.
4. Proposal inspector header: `Back to proposal`, `Change n of N`, Previous, Next.
5. Proposal inspector body shows changed fields first as explicit Before → After values, followed by a collapsed `All details` section using the existing inspector anatomy.
6. Added/updated/removed behavior:
   - Added: candidate element is present and marked `Added`.
   - Updated: candidate element is present and marked `Updated`; only changed fields lead.
   - Removed: accepted element is rendered at its prior position as a non-interactive red dashed ghost, with enough adjacent context to understand the deletion.
7. Clicking any candidate node/edge directly while in Proposal mode opens the same read-only inspector. Unchanged elements show an `Unchanged` badge and complete candidate details.
8. Back returns to the proposal overview at the prior scroll position. Collapse/reopen preserves the selected change/detail state for the same proposal.
9. Approve, Request changes, and Reject remain proposal-wide, human-only actions. They are available only on the overview; the detail state navigates back to them.
10. Invalid proposals must list actionable validation problems instead of only saying that the candidate is invalid. Each problem should identify the affected element when possible and use the same focus/navigation behavior.
11. Scenario detail semantics:
    - Rename `Conditions` to `Decisions`.
    - Pair each decision value with its source node or human gate (for example `Recommend next action — Pursue`, `Paid enrichment approval — Denied`).
    - Replace the bare `Outcome` value with `Ends at — <terminal node label>` and optionally a secondary terminal-status chip.
    - Do not render unexplained duplicate values such as `disqualify / disqualify`.
12. Scenario canvas emphasis:
    - selected path nodes, edges, and edge labels remain fully visible;
    - every unrelated node, edge, badge, and edge label is muted together;
    - branch labels must never remain prominent over a muted graph.
13. Scenario path playback:
    - selecting a scenario plays one ordered Start-to-End traversal;
    - selected edges illuminate sequentially and destination nodes briefly pulse;
    - provide `Replay path`;
    - replay does not mutate graph, scenario, history, or runtime state;
    - `prefers-reduced-motion` shows the final highlighted state without traversal animation.
14. Preserve long-path in-place expansion, pagination, collapse, and the three working downloads.
15. Hide the graph-level Capabilities strip for the demo in every workspace mode and reclaim its full vertical space for the canvas. Preserve the underlying capability data, validation, exports, WebMCP contract, and inspector/settings functionality; this is presentation-only removal.

### Out Of Scope

- Real graph execution, telemetry ingestion, HITL response/resume, or a runtime adapter.
- Fabricating runtime evidence or calling a scenario animation “runtime.”
- Schema/domain changes unless an existing comparison or scenario projection cannot express an acceptance requirement.
- Editing candidate nodes during proposal review.
- Per-scenario approval state; freezing the contract remains the human acceptance boundary.
- Landing page, library, inventory, header alignment, minimap, auto-layout, or unrelated visual changes.
- Netlify deployment, Git push, or production publication.

### Non-Negotiables

- Exactly three WebMCP tools remain exposed.
- Accepted graph remains unchanged until a human approves the proposal.
- WebMCP cannot approve, reject, request changes as the human, freeze, or unfreeze.
- Proposal and scenario modes remain read-only projections.
- Existing downloads must retain current payload semantics.
- Reuse Phosphor icons and current GraphContract tokens/components; do not add an icon library or new visual language.
- No generated design image is an implementation source. The live portal and current baseline screenshots are the sole visual authority.
- This package adds behavior and content inside existing components; it does not authorize restyling, resizing, re-spacing, or replacing those components.
- No destructive reset of the current dirty working tree and no modification of unrelated user/Lead changes.

## Implementation Target

- Product route: GraphContract workspace at `/`
- Viewports: primary desktop demo; retain current compact/responsive behavior
- Likely entry points:
  - `src/features/workspace/graph-workspace.tsx`
  - `src/features/proposals/proposal-panel.tsx`
  - `src/features/proposals/proposal-overview.tsx`
  - `src/features/inspector/context-inspector.tsx`
  - `src/features/scenarios/scenario-panel.tsx`
  - `src/adapters/react-flow/project-graph.ts`
  - relevant canvas edge/node presentation CSS
- Reuse required: `ModePanelShell`, existing inspector primitives, proposal comparison, candidate graph projection, selection/focus helpers, scenario ordered node/edge data.
- New components expected only when composition cannot remain local, for example `ProposalChangeInspector`, `ProposalChangeNavigator`, or `ScenarioDecisionList`.
- Stack: React 19, TypeScript, Zustand, React Flow, Phosphor; no shadcn/Radix dependency is installed, so reuse local primitives instead of adding a new component system.

## UX Flow

### Proposal overview

1. A WebMCP proposal opens Proposal mode and the right rail.
2. The overview shows rationale, validity, change counts, and the ordered change list.
3. Selecting a change focuses the canvas and enters proposal inspector state in one action.
4. Global actions stay human-only and exist on the overview.

### Proposal inspector

1. Header identifies the entity, change index, and Previous/Next controls.
2. Changed fields appear before full details.
3. Previous/Next changes both the inspector and canvas focus.
4. Back returns to the prior overview position.
5. Direct canvas selection opens the same inspector; unchanged entities remain inspectable.

### Scenario review

1. Freezing opens Scenario mode.
2. Selecting/expanding a scenario highlights only its path and starts one traversal animation.
3. Scenario detail explains decisions in their originating context and names the terminal node.
4. Replay reruns presentation only.
5. Downloads remain reachable and functional.

## Component Map

| Region | User job | Local component target | Required states | Notes |
|---|---|---|---|---|
| Proposal overview | Understand and choose changes | Existing `ProposalPanel` / `ProposalOverview` | valid, invalid, pending, collapsed | Keep global actions here |
| Change row | Navigate to evidence | Proposal change list item | added, updated, removed, focused | Entire row is one accessible button |
| Proposal inspector | Inspect candidate semantics | Existing inspector primitives in read-only wrapper | added, updated, removed, unchanged | Changed fields first |
| Change navigation | Traverse without returning | New/local header control | first, middle, last | Disabled Previous/Next at boundaries |
| Canvas focus | Locate change | Workspace selection/focus projection | node, edge, removed ghost | Do not mutate accepted selection/history |
| Scenario details | Understand path decisions | Existing `ScenarioPanel` | collapsed, expanded, selected | Use semantic decision labels |
| Path playback | See path direction | Existing custom edges/nodes | idle, playing, complete, reduced motion | Presentation state only |

## Visual Contract

- Match current Classic theme, density, type hierarchy, borders, radii, and icon system.
- The current live portal and baseline screenshots define all portal geometry and styling.
- New states must be composed from the existing Proposal panel, ModePanelShell, inspector primitives, scenario rows/cards, buttons, icons, typography, spacing, borders, colors, and panel geometry.
- Preserve the actual product graph and existing components.
- Change status must use icon/text/border treatment in addition to color.
- Muted canvas content must remain faintly legible for topology context, approximately 12–22% visual emphasis; selected path/change remains at full emphasis.
- A removed ghost is dashed, labelled `Removed`, non-interactive, and never confused with accepted topology.
- Animation should be restrained: edge traversal around 250–450ms per hop with a bounded total duration; node pulse once on arrival; no infinite motion.

## State Matrix

| State | Trigger | Expected UI | Accessibility / QA |
|---|---|---|---|
| Proposal overview | Proposal arrives/back action | Overview, scroll restored, global actions | Focus returns to triggering row on Back |
| Added detail | Select `+` row | New element focused; no Before value | `Added` announced textually |
| Updated detail | Select `~` row | Only changed fields lead with Before → After | Values readable without color |
| Removed detail | Select `−` row | Ghost at previous location plus old details | Ghost excluded from editing/connection |
| Unchanged detail | Click unchanged candidate element | Full read-only candidate inspector | Badge says `Unchanged` |
| Proposal collapsed | Collapse | Canvas expands; proposal remains pending | Reopen restores state |
| Invalid proposal | Validation failure | Actionable issue list and disabled Approve | Each locatable issue can focus canvas |
| Scenario selected | Click path | In-place expansion and selected path emphasis | `aria-pressed`/expanded remain correct |
| Scenario playback | Select/Replay | Ordered edge/node emphasis | No graph mutation |
| Reduced motion | OS preference | Immediate final selected state | No sequential animation |

## Data And Content Contract

| Field/action | Source | Required | Fallback |
|---|---|---|---|
| Change status/entity/id | Existing proposal comparison | Yes | Never infer from label text |
| Before/after fields | Accepted and candidate entities | Yes for updates | Show `Not set` for absent values |
| Edge framing | Accepted/candidate source and target | Yes | Fit affected element if endpoint unavailable |
| Decision source | Scenario edge plus source node/HITL semantics | Yes | Source node label + route label |
| Terminal label/status | Scenario terminal node/outcome | Yes | Terminal node label; secondary raw status optional |
| Ordered playback | Existing scenario ordered nodes/edges | Yes | Final static highlight if order incomplete |

## Accessibility Requirements

- Change rows, navigation, collapse, Replay, Back, and disclosure controls are keyboard reachable.
- On entering proposal inspector, focus moves to its heading; Back restores focus to the change row.
- Previous/Next announce the new change index and entity name.
- Canvas dimming is supplementary; status and differences are available as text.
- Icon-only controls need explicit labels and at least the current project touch target.
- Honor reduced motion.

## QA Acceptance Checklist

- [ ] Proposal rail collapses and does not immediately reopen; explicit reopen restores the same proposal subview.
- [ ] Capabilities strip is absent in Design, Proposal, Scenario, and Runtime modes; its former whitespace is reclaimed by the canvas without moving or resizing the top toolbar groups.
- [ ] Clicking each of the Enterprise Account Research proposal's three rows focuses the correct element and opens its details.
- [ ] `Enrich qualified contact` shows HITL Off → Before execution, approval No → Yes, and denial route None → Monitor when those are the actual changed fields.
- [ ] Updated edge frames both endpoints; added denial edge frames `Enrich qualified contact` and `Monitor account`.
- [ ] Previous/Next traverses all changes; boundaries disable correctly; Back restores overview scroll/focus.
- [ ] Direct canvas click opens proposal-aware details for changed and unchanged node/edge entities.
- [ ] A test proposal removing an entity renders a non-interactive removed ghost and exposes old details.
- [ ] Invalid proposal displays actionable validation reasons and locatable issues focus the canvas.
- [ ] Approve/Request changes/Reject authority and accepted-graph immutability remain unchanged.
- [ ] Path 1 reads `Decision: Recommend next action — Disqualify` and `Ends at: Disqualify account`, not unexplained duplicate `disqualify` values.
- [ ] Path 2 distinguishes `Pursue`, enrichment approval, and CRM approval by source; it ends at `Qualified account prepared`.
- [ ] Path 4 distinguishes direct Monitor from enrichment-denied Monitor.
- [ ] Selecting a scenario mutes unrelated edge labels as well as nodes/edges.
- [ ] Playback traverses only selected scenario edges in order, runs once, can replay, and becomes static under reduced motion.
- [ ] Long paths still expand in place and pagination/collapse remain stable.
- [ ] All three downloads still produce valid files.
- [ ] Exactly three WebMCP tools remain exposed.
- [ ] Existing Vitest, lint, production build, and full cold Chromium Playwright suite pass with zero skip/fixme/only and no unexpected console/page errors.
- [ ] New focused Playwright journeys cover proposal drilldown/navigation/collapse, removed ghost, invalid issue focus, scenario semantic labels, label muting, replay, and reduced motion.
- [ ] Existing capability schema/validation/export/WebMCP tests remain green despite the strip being hidden.

## Deviation Register

| Area | Expected | Allowed deviation | Approval |
|---|---|---|---|
| Visual dimensions | Match existing rail and inspector system | Responsive sizing may follow current workspace constraints | No extra approval needed |
| Motion timing | Restrained sequential traversal | Exact milliseconds may adapt for legibility and test stability | No extra approval needed |
| Removed context | Ghost plus adjacent topology | If full adjacency is technically expensive, show ghost and both endpoint anchors first; do not omit the ghost | Report before completion |

## Open Decisions / Blockers

- None for the scoped package. Runtime remains intentionally excluded.
- Do not deploy or push. Return a cleanly described local implementation and verification result for owner browser acceptance.
