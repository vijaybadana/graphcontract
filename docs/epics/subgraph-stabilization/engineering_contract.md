# Subgraph Stabilization Engineering Contract

Status: accepted
Owner: Backend Engineer Lead
Source: independent localhost QA delegated from task `01a04256-beed-7c80-854b-0101c17f20d7`

## Accepted outcome

Stabilize the first-class subgraph foundation without expanding the LangGraph taxonomy.

- WebMCP review-only proposals can add/update/dissolve subgraphs, assign/remove member nodes, and add nodes with validated `parentId`; approval/rejection, optimistic timestamp checks, validation, preview, and human-only authority remain intact.
- Collapse/expand activates with mouse, Enter, and Space in a mounted React Flow canvas, without canvas shortcut or selection side effects.
- Expanded subgraphs have dependable selection/drag surfaces; member nodes remain interactive; false visual containment is prevented through tested drop-parenting or an equally explicit representation.
- Palette and inspector insets keep selected subgraph controls reachable at compact and 1440px desktop widths.
- Demo replacement requires explicit confirmation or a proven one-step Undo restoration and remains locked during freeze/review.
- Existing subgraph persistence, relative coordinates, canonical edge preservation/proxies, legacy loading, and frozen locks remain unchanged.
- Repository test, lint, and build commands return green without global lint-rule suppression.

## Protected contracts

- Exactly three WebMCP tools.
- WebMCP never approves, rejects, freezes, or directly mutates the accepted graph.
- Dissolving a subgraph preserves children and canonical edges.
- No Command routes, loops, parallel workers, merge elements, simulation, deep-nesting polish, or broad redesign.
- Preserve unrelated user changes; no public deployment without explicit authority.

## Acceptance

- Domain/schema and end-to-end proposal tests cover create, reparent, preview, approve, reject, and `expectedGraphUpdatedAt`.
- Mounted canvas tests cover keyboard toggle, selection/drag/child interaction, containment agreement, and compact/desktop panel occlusion.
- `npm test`, `npm run lint`, and `npm run build` pass on the integrated candidate.
- Local browser acceptance covers compact and 1440px layouts; any destructive replacement of existing localhost data requires action-time approval.
