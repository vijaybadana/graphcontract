# Compound Graph Layout Lead Plan

Contract: owner implementation envelope delivered 2026-09-04 in task `01a04256-beed-7c80-854b-0101c17f20d7`
Candidate: `/Users/vijaybadana/graphcontract`, `main`, starting at `8e81e41`
Strategy: replace the synchronous one-level geometry helper with an asynchronous ELK-backed compound-layout service, then route React Flow node and edge configuration through tested registries while leaving canonical graph semantics and visuals unchanged.
Dispatch waves: W1 geometry adapter and official-library experiment; W2 rendering registry and integration after the geometry contract is frozen; W3 integrated browser closure.
Concurrency: geometry mutation is isolated to application layout/tests/dependency notices; rendering inspection may run read-only in parallel, but projection/workspace integration is sequential because both consume shared canvas types.
Scheduling: direct Lead; reason: two implementation packages plus one Lead-owned integration/QA boundary do not require durable scheduler recovery state.
Scenario coverage: nested compounds, 1/5/10-child sizing, and relative coordinates → P1 → focused geometry tests; semantic edge persistence across modes and selective proposal focus → P2 → resolver/projection DOM tests; Hierarchical Deep Research across Design/Proposal/Scenario/frozen → P3 → existing production-path Playwright plus localhost inspection.
Architecture conformance: model unchanged; ELK geometry and React Flow projection remain adapters over schema-v6 graph data.

Contract preservation:
- Canonical graph/schema and human authority remain unchanged → production path: workspace service and WebMCP proposal boundary → prohibited failure: layout mutates topology or bypasses review/freeze → package: P1/P3 → proof: graph equality and existing authority suites.
- Expanded containers fit descendants recursively → production path: `layoutWorkflowGraph` on library load, structural acceptance, mutations, collapse/expand, and Auto-layout → prohibited failure: clipped/escaped/overlapping descendants → package: P1 → proof: hierarchy conversion, bounds, and count fixtures.
- React Flow remains the renderer → production path: `projectGraphToCanvas` → prohibited failure: ELK-derived render component or canonical endpoint rewrite → package: P1/P2 → proof: projection tests.
- Edge semantics survive transient UI states → production path: canonical edge resolver used by the routing component → prohibited failure: frozen/proposal/scenario state replaces semantic color, label, dash, or arrowhead → package: P2 → proof: deterministic priority and DOM matrix.
- No ResizeObserver feedback loop or visible thrash → production path: cached structural layout request committed once through workspace state → prohibited failure: repeated resize/layout cycle → package: P3 → proof: coalescing tests and warning-free browser inspection.

Work packages:
- P1 — ELK compound geometry service with stable dimensions, explicit ports, recursive bounds, relative React Flow coordinates, structural-signature cache, dependency/licence notice, and focused tests; owner: embedded implementation specialist; model: gpt-5.6-terra; effort: XHigh; depends on: none.
  - Inputs: `src/application/layout-workflow.ts`, canvas geometry constants, schema-v6 graph types, current library loading and workspace layout entrypoints, elkjs 0.12.0 official API/licence.
  - Method: preserve the public graph contract while making layout asynchronous; isolate pure hierarchy conversion/result mapping from the ELK runner and keep authored geometry an explicit opt-out only where already contracted.
  - Boundary/isolation: application layout modules/tests plus package metadata and third-party notice; do not change projection, React components, graph schema, or runtime.
  - Produces/freeze: tested async layout API and generic compound-tree adapter, including synthetic third-level and 1/5/10-child fixtures.
  - Done/return: focused tests pass; report exact changed files/API and any ELK cross-hierarchy limitation.
- P2 — node render registry and canonical edge semantic/state resolver; owner: embedded implementation specialist; model: gpt-5.6-terra; effort: High; depends on: P1.
  - Inputs: frozen P1 API, `project-graph.ts`, canvas node/edge components, workspace nodeTypes/edgeTypes, current theme tokens.
  - Method: centralize render metadata without altering component markup; resolve semantic tokens first and transient overlays through a documented priority table.
  - Boundary/isolation: projection/canvas/workspace registry modules and focused tests; do not change domain schema, proposal authority, or layout computation.
  - Produces/freeze: registry-backed React Flow configuration and deterministic edge presentation resolver.
  - Done/return: focused projection/DOM tests pass and unrelated proposal edges remain muted.
- P3 — integration and failure diagnosis; owner: Lead; exception: async state transitions, package reconciliation, and production-path browser behavior cross both package seams; boundary: workspace/store wiring, regression repair, contract closure, and localhost visual inspection; depends on: P1/P2; focused check: selected through the repository test policy after integration.

Integration: freeze the async layout contract first, then adapt application/store/library callers, accept the rendering registry, and finally reconcile projection focus and browser geometry against existing authority behavior.
Diagnosis: ELK `INCLUDE_CHILDREN` has historical cross-hierarchy edge limitations; cheapest decisive experiment is a three-level graph with explicit EAST/WEST ports and one cross-boundary edge before application integration.
Research: official elkjs 0.12.0 package and repository are the primary sources; maintainer issue evidence is secondary and must not justify topology rewrites.
Escalate only if: satisfying arbitrary nested layout requires adding canonical subgraph nesting fields, rewriting stored edge endpoints, or weakening existing human/proposal/freeze authority.
