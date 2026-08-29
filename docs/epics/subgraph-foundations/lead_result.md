# GraphContract Subgraph Foundations Lead Result

Disposition: candidate_ready
Contract: `docs/epics/subgraph-foundations/engineering_contract.md`
Plan: `docs/epics/subgraph-foundations/lead_plan.md`
Deployable code candidate: `graphcontract`, `main`, `8281aad`
Behavior:
- Users can create, configure, group/ungroup, move, collapse, expand, persist, and dissolve one-level subgraphs without rewriting child edges.
- Collapsed projection hides members/internal edges and renders deterministic protected boundary proxies; expanding restores original endpoints and selection.
- A separate valid Research Supervisor demo exercises nested Start/Supervisor/Supervisor Tools/End flow while the Customer Support sample remains unchanged.

Reliability: guarded; package-focused suites passed and repository `npm run build` completed successfully for the integrated candidate.
Staging preparation: not applicable; no deploy was requested.
Runtime: `8281aad`, existing local Vinext runtime, `http://localhost:3000/`, draft mode.
UAT handoff: local browser interaction verified palette creation, inspector controls, parent selection, collapse/expand stacking, structured WebMCP readback, and unchanged canonical edges.
Gate: Vijay/local pending; load the Research Supervisor demo, move/collapse/expand it, reload, then freeze and inspect its single generated scenario.
Remaining: full destructive demo replacement was left to Vijay; localhost currently contains one temporary empty QA subgraph pending authorized reset.
