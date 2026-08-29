# GraphContract evidence-backed design plan

Date: 2026-08-30

## Goal

Create the minimum complete visual language required to truthfully represent the execution topology and human decision boundaries found across the ten reviewed LangGraph repositories. The system must remain readable on a white React Flow canvas and must work equally for direct human editing and WebMCP-authored proposals.

## Evidence rule

An abstraction receives a canvas treatment only when it changes at least one of:

- reachability;
- execution ownership;
- execution scope;
- concurrency;
- durability;
- side-effect risk;
- human authority.

Prompts, provider settings, schemas, tool inventories, reducer code, retry delays, runtime IDs, and trace metrics remain inspector-only.

## Fixed foundation

- One composable `Step` object underlies Agent, Action, Tool, and Human-review presets.
- Start, End/Outcome, Step presets, and Subgraph belong in inventory.
- AI, Human-owned, HITL, Tool, Guardrail, Sensitive side effect, Store R/W, Retry/fallback, Opaque/prebuilt, and Degraded are modifiers or statuses.
- Checkpointer, working state/reducers, runtime mode, and long-term-store availability are graph/subgraph capabilities.
- Routing uses the separately approved routing system: static, conditional, Command, loop, and fallback.
- Router is never a special node. Loop is derived from topology. Fallback is a branch role.

## Required design boards

### 1. Step anatomy and composable modifiers

Show the base Step, four inventory presets, modifier placement zones, compatible combinations, conflict/overflow behavior, and the selected-node inspector. The canvas must stay readable with no more than three visible compact modifiers; overflow opens the inspector.

### 2. Human control and side-effect boundaries

Distinguish a Human-review Step from HITL timing on another Step. Show `before`, `inside`, and `after` gates, the paused canvas state, the human-input sheet, allowed responses, resume destinations, and approval before a sensitive side effect.

### 3. Dynamic parallelism and aggregation

Show `Send ×N` as an elastic map/fan-out relationship, a template worker, reducer-backed merge/join, bounded refinement loop, collapsed design-time state, and expanded runtime-instance state. Never fabricate a fixed number of workers at design time.

### 4. Durability, state, and memory scope

Separate working state/reducers, thread checkpointing, and long-term Store read/write. Show graph-level and subgraph-level capability strips, per-step Store R/W badges, state-boundary inspector, runtime-mode variation, and retry policy as a compact secondary modifier.

### 5. Provenance and system boundaries

Show declared, runtime-generated, derived-semantic, and external-orchestration provenance. Include an opaque/prebuilt Step, a spawned-run portal relationship, a grey dashed external-orchestration edge, source evidence in the inspector, degraded/unimplemented status, and a reveal-evidence overlay.

### 6. Templates, scenarios, and proposal review

Show how the ten normalized real-world templates are discovered without crowding the main canvas. Include the template gallery, a loaded complex graph, generated branch-scenario rows, one scenario highlighted on canvas, proposal diff states, and the human-only freeze/approve boundary.

## Visual language

- Base: warm white canvas, near-black text, hairline neutral borders, subtle shadows, 8–12 px radii.
- Semantic colors: green for Start/valid, graphite for deterministic work, amber for AI, blue for tools/subgraphs, rose for human/HITL, violet/indigo for dynamic routing, orange for loops/retries, red only for invalid or dangerous unresolved state.
- Use shape, stroke pattern, icon, and label together; never rely on color alone.
- Preserve the current compact node proportions and right-side inspector.
- Use real Phosphor icons already installed in the repository; no external icon pack or bitmap icon assets.

## Icon source and intended mapping

Use `@phosphor-icons/react` exports (prefer the `*Icon` names):

- `RobotIcon` or `BrainIcon`: AI executor;
- `PersonSimpleIcon` / `HandPalmIcon`: human owner;
- `PauseCircleIcon`: HITL gate;
- `WrenchIcon`: Tool executor;
- `ShieldCheckIcon`: guardrail;
- `WarningIcon` + `LockSimpleIcon`: sensitive side effect;
- `DatabaseIcon` with directional cue: Store read/write;
- `ArrowsClockwiseIcon`: retry policy;
- `CubeIcon` / `EyeSlashIcon`: opaque or prebuilt topology;
- `WarningCircleIcon`: degraded, invalid, or unimplemented status;
- `GitForkIcon` / `ShareNetworkIcon`: Send fan-out;
- `ArrowsInIcon` / `IntersectIcon`: merge/reducer join;
- `ArrowSquareOutIcon`: spawned run;
- `LinkSimpleIcon`: external orchestration;
- `HardDrivesIcon` / `FloppyDiskIcon`: checkpointer/durable thread;
- `BracketsCurlyIcon`: working state/schema;
- `LightningIcon`: Command routing.

Actual graph paths, boundaries, gates, fan-out forks, joins, and arrowheads are native React Flow/SVG/CSS geometry, not image assets.

## Interaction rules

- Inventory creates objects; inspector/right-click composes modifiers.
- Selecting any compact badge scrolls the inspector to its configuration section.
- Modifiers change node anatomy only when they communicate execution-critical semantics.
- A frozen graph uses reduced saturation plus lock markers while preserving legibility.
- WebMCP proposals use the same components with added/updated/removed diff treatments; they never bypass human approval or freeze.
- Every visually derived or external relationship exposes its provenance on selection.

## Scope priority

Challenge implementation order after routing:

1. Step/modifier anatomy.
2. HITL timing and human input.
3. Send ×N and merge.
4. Graph-level checkpointer plus Store R/W distinction.
5. Template gallery with three shipped templates and scenario highlighting.

Post-challenge depth:

- runtime introspection for opaque/prebuilt graphs;
- spawned runs and external orchestration;
- full provenance overlay and source navigation;
- state/reducer analysis;
- trace, cost, latency, and runtime-instance expansion.

## Deliverables

- Six 16:9 design boards saved beside this document.
- One implementation contract translating each board into reusable canvas, inspector, and WebMCP semantics.
- No production code changes in this design pass.
