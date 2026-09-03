# Flat Inspector Design Contract

## Purpose

Make the GraphContract inspector feel like one direct property surface instead of cards nested inside cards. The selected graph entity owns the header; its editable fields appear directly below it.

Authoritative visual reference:

- `docs/design-system/inspector-flat-start-reference.png`

The image is presentation guidance. Existing product semantics, accessibility, validation, authority boundaries, and canonical graph schema remain authoritative.

## Global Rules

1. Use one outer inspector surface. Do not add an inner `Node details`, `Edge details`, or similar card.
2. Remove the generic visible headings `CONTEXT` and `Inspector` whenever an entity is selected.
3. Header anatomy is always:
   - the existing semantic entity icon;
   - the entity's actual name;
   - a target/crosshair `Focus` action when the entity can be focused on canvas;
   - an overflow menu for secondary actions when necessary.
4. Do not show a textual type subtitle such as `BOUNDARY NODE`. The icon, semantic colour, fields, and accessible name carry the type.
5. Reuse `NodeVisualIcon` and `graphNodeVisualKind` from `src/features/canvas/node-visual-taxonomy.tsx`. For Start, this must render the existing Phosphor `PlayCircleIcon`; never recreate an approximate icon from the PNG.
6. Put fields directly on the panel surface. Use spacing and thin dividers instead of container borders.
7. Remove explanatory paragraphs when the label/control is self-explanatory. Provide concise accessible descriptions or tooltips where clarification is still required.
8. Hide empty optional/global states. In particular, do not render `No proposal waiting` beneath every selected entity.
9. Keep the existing `Edit & review` / `Scenarios` workspace navigation unless a separately approved change explicitly replaces it.
10. Preserve responsive panel resizing, scrolling, keyboard focus visibility, and frozen/proposal/runtime read-only behavior.

## Shared Inspector Anatomy

### Entity header

- Semantic icon tile using the existing taxonomy and colour tokens.
- Actual entity label, bold.
- `Focus` with the existing target/crosshair icon.
- Overflow menu or compact actions as required.
- One subtle divider below the header.

### Basics

Render these directly on the surface whenever supported by the selected entity:

- Name
- Description
- Parent subgraph

Do not render parent-subgraph helper prose by default. Preserve any essential meaning through accessible description/tooltips.

### Core configuration

Render the entity-specific controls described by the matrix below. Core controls are visible without opening a nested card.

### Optional modifiers

Optional Step concerns use compact collapsible sections and one `Add modifier` entry point. Do not show a wall of empty configuration cards.

- Active modifier: show its section and concise status summary.
- Inactive modifier: available from `Add modifier` rather than occupying permanent space.
- Validation error or explicit focus request: automatically reveal the relevant section and focus/announce the failing control.
- Frozen, proposal, scenario, or runtime projection: preserve the existing read-only rules.

Shared optional Step modifiers include:

- HITL
- Sensitive effect
- Store access
- Retry/fallback policy
- Guardrail
- Internal tools where supported
- Readiness
- Opaque/prebuilt boundary
- Provenance/evidence controls already supported by the product

### Actions

- Focus is a primary utility in the header.
- Duplicate and Remove are secondary actions in a compact footer or overflow menu.
- Remove remains visually dangerous and confirmation behavior must remain unchanged.
- Do not duplicate actions in multiple locations.

## Entity Field Matrix

| Entity | Header visual | Always-visible core configuration | Optional/conditional configuration |
| --- | --- | --- | --- |
| Start | Start icon + actual name | Basics | Existing provenance/evidence fields when applicable |
| Task | Task icon + actual name | Basics; deterministic executor identity | Shared Step modifiers |
| Agent | Agent icon + actual name | Basics; AI executor identity | Internal tools and shared Step modifiers |
| Tool | Tool icon + actual name | Basics; tool executor identity | Sensitive effect, HITL, retry and other shared Step modifiers |
| Human | Human icon + actual name | Basics; human executor identity | Human response/HITL configuration supported by the schema and other valid Step modifiers |
| Merge | Merge icon + actual name | Basics; reducer; aggregate state; completion mode; continuation mode | Quorum when completion is quorum; dynamic-input status where applicable |
| End | End icon + actual name | Basics; outcome kind; outcome detail | Existing provenance/evidence fields when applicable |
| Subgraph | Subgraph icon + actual name | Name; collapse/structure controls already supported | State, Checkpointer and Store capability overrides |
| Edge | Existing semantic line/edge icon + human-readable source to target title | Mode; label; source; target | Condition for Conditional/Command; Send metadata for Send; loop cap only when topology derives a loop; provenance/evidence |
| External relationship | Existing relationship icon + human-readable relationship title | Kind; source; target; label | Required provenance/evidence |
| Graph settings | Graph/settings icon + graph name | State, Checkpointer, Store, Runtime | Provenance/external-orchestration settings already supported |

## Proposal Ownership

Agent proposals are graph-level, not node-level.

- At most one graph proposal/review is presented as the global pending proposal.
- A proposal can contain operations across multiple nodes, edges, subgraphs, relationships, and graph capabilities.
- Do not append the global `ProposalPanel` after every `ContextInspector` selection.
- When no proposal or request-changes record exists, render no empty proposal panel in the entity inspector.
- When a proposal exists, expose it through the existing global `Proposal` projection/view and its human-only review actions.
- An affected selected entity may show a compact `Changed in proposal` indicator, but must not duplicate the complete proposal review UI.
- Approval, request changes, rejection, freeze, and unfreeze remain human-only UI actions.

## Section Components

Prefer a small reusable presentation system rather than bespoke markup for every entity:

- `InspectorShell`
- `InspectorEntityHeader`
- `InspectorSection`
- `InspectorField`
- `InspectorToggleRow`
- `InspectorStatusRow`
- `InspectorModifierSection`
- `InspectorActions`

Names may follow repository conventions, but one shared implementation boundary must control spacing, dividers, typography, focus, read-only styling, and validation presentation.

## State Rules

- No selection: show graph settings using the same flat shell.
- Single selection: show the selected entity inspector.
- Multiple selection: show only valid bulk actions and a concise selection header; do not pretend there is one entity's field form.
- Pending proposal: accepted graph remains unchanged and locked according to current authority rules.
- Frozen contract: fields remain read-only; unfreeze authority is unchanged.
- Scenario/runtime/proposal projections: preserve current read-only projection semantics.
- Invalid fields: errors must remain programmatically associated, visible, and focusable.

## Non-goals

- No domain/schema rename.
- No graph migration.
- No new WebMCP tools or authority.
- No new runtime behavior.
- No changes to canvas topology, layout, ports, edges, scenario derivation, exports, persistence, or downloads.
- No redesign of the node palette, header, canvas, or library in this package.

## Acceptance and Verification

1. Start, Task, Agent, Tool, Human, Merge, End, Subgraph, each edge mode, relationship, graph-settings, and multi-selection states use the shared flat shell.
2. Existing semantic icons are reused from code, including Start's `PlayCircleIcon` through `NodeVisualIcon`.
3. No selected entity displays `CONTEXT`, generic `Inspector`, or an inner details card.
4. Parent-subgraph explanatory prose is absent from the default visible inspector.
5. No empty `No proposal waiting` panel appears beneath selected entities.
6. Pending proposal review remains globally reachable and all human-only actions work.
7. Validation focus requests open the correct compact section.
8. Frozen, pending, scenario, proposal, and runtime read-only behavior is unchanged.
9. Focus, Duplicate, Remove, modifier controls, selects, text fields, dialogs, and keyboard navigation remain functional.
10. Focused DOM tests, relevant cold Chromium journeys, lint, production build, and diff check pass without skips/fixmes/only or new console errors.
