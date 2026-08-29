# GraphContract visual-system implementation contract

Date: 2026-08-30

## 1. Product rule

The canvas displays execution topology and human decision boundaries. A concept becomes visually first-class only when it changes reachability, ownership, scope, concurrency, durability, side-effect risk, or human authority.

The canvas must never imply a stronger claim than the evidence supports. Native compiled edges, runtime-generated behavior, derived semantics, spawned runs, and external orchestration have different treatments.

## 2. Taxonomy and placement

### Inventory objects

These can be dragged from the palette:

| Item | Stored concept | Default treatment |
|---|---|---|
| Start | entry sentinel | green outlined compact node |
| End / Outcome | terminal sentinel with outcome label | neutral compact node; semantic terminal status |
| Step | composable work step | neutral node |
| Agent preset | Step with `executor=ai` | amber AI executor |
| Tool preset | Step with `executor=tool` | blue Tool executor |
| Human review preset | Step with `executor=human` | rose Human executor |
| Subgraph | first-class collapsible container | blue container with internal Start/End |

`Action` may remain a convenience preset during migration, but it maps to a deterministic Step. Router, loop, fallback, checkpointer, Store, guardrail, and HITL are not palette nodes.

### Step modifiers

Apply through right-click or inspector. Several may coexist.

| Modifier | Canvas cue | Inspector owns |
|---|---|---|
| AI | amber AI chip | model, prompt, response schema |
| Human-owned | rose person chip | human role and responsibility |
| HITL gate | rose pause chip | before/inside/after, response type, resume destinations |
| Tool | blue wrench chip | registered ToolNode versus internal call |
| Guardrail | violet shield chip | boundary, enforcement and failure route |
| Sensitive side effect | violet lock/warning chip | mutation target, authorization, approval and idempotency |
| Store read | green database `R` chip | namespace, key/scope and durability |
| Store write | green database `W` chip | namespace, retention and write conditions |
| Retry/fallback | orange circular-arrow chip | cap, backoff, exception and provider fallback |
| Opaque/prebuilt | dashed cube chip | factory, declared interface and introspection status |
| Degraded/unimplemented | amber or red warning status | evidence and readiness details |

### Graph/subgraph capabilities

Display in a slim header capability strip or subgraph boundary, not on every node:

- working state and reducers;
- checkpointer/durable thread;
- runtime mode;
- long-term Store availability;
- external-orchestration visibility;
- provenance overlay state.

### Relationships

| Relationship | Treatment |
|---|---|
| Static edge | solid graphite control path |
| Conditional branch | solid purple branch with required domain label |
| Command | dashed indigo branch with Lightning marker |
| Loop/return | curved orange return edge with optional cap |
| Fallback | muted dashed purple conditional role |
| Send/map | blue-violet fork marker, `×N`, template destination |
| Merge/reducer | converging diamond/join marker with reducer label |
| Spawned run/thread | double-line portal relationship, never a control arrow |
| External orchestration | grey dashed boundary-crossing path |
| End-of-turn re-entry | terminal annotation, never an invented End-to-Start edge |

## 3. Step component anatomy

Reference: `step-component-system.png`.

Required regions:

1. executor icon slot;
2. semantic kind/eyebrow;
3. title and optional one-line description;
4. input/output handles;
5. bottom modifier rail;
6. status zone;
7. proposal/evidence overlays.

Rules:

- The node shell does not change class when a modifier is added.
- Executor defines the leading icon/color; modifiers occupy the rail.
- Show at most three modifier chips on normal canvas zoom. Collapse the rest into `+N`.
- Clicking any chip selects the node and focuses the corresponding inspector section.
- A node may legitimately combine AI, Human/HITL, Tool/Action, Store and Sensitive semantics.
- Do not add a deterministic-code badge; the unmodified Step is deterministic work.

States must be distinguishable by more than color:

- hover: stronger outline/shadow;
- selected: blue outline plus focus halo;
- invalid: red outline, status label and warning icon;
- frozen: reduced saturation plus Frozen/lock label;
- proposed added/updated/removed: existing diff vocabulary layered without replacing semantic badges.

## 4. Human control and HITL

Reference: `human-control-hitl.png`.

### Human Step versus HITL modifier

- Human review Step: the human performs a registered graph step.
- HITL modifier: another Step pauses before, during or after execution.
- A Step may include both an AI/Tool executor and HITL.

### Gate timing

- `before`: pause marker on the incoming boundary immediately before execution;
- `inside`: pause marker embedded at the node boundary/body;
- `after`: pause marker on the outgoing boundary after result production.

### Paused state

When a run/proposal requires input:

- keep the graph readable and highlight the exact gate;
- open a right-side sheet or modal with reason, agent proposal, allowed responses and optional guidance;
- render each response as a semantic route/outcome;
- clearly state that only the human can resume;
- do not let WebMCP approve, reject, resume, or freeze.

Sensitive actions show authorization, approval, and idempotency as separate inspector policies. HITL alone does not explain the reason for the pause.

## 5. Dynamic parallelism and merge

Reference: `dynamic-parallelism-merge.png`.

### Design mode

- Store one Send/map relationship, one destination template and one merge/reducer definition.
- Display a fork marker labelled `Send ×N`.
- Display the template worker as stacked layers with `×N`.
- Never fabricate a fixed number of workers.

### Runtime mode

- Expand observed instances only when trace/runtime data exists.
- Instance nodes are projections and carry runtime IDs; they do not mutate the contract.
- A mode switch controls Design versus Runtime instance projection.

### Merge

- Converging marker communicates waiting for dynamic inputs.
- Inspector exposes reducer name, aggregate state and continuation policy.
- Reducer implementation and branch-local payload remain inspector-only.

### Bounded refinement

An actual return edge remains topology. A model or SDK retry that repeats the same Step internally remains a Retry modifier. Never draw a loop from retry configuration alone.

## 6. Durability, state and memory

Reference: `durability-state-memory.png`.

These concepts must never collapse into a generic brain icon:

- Working state: per-run data and reducers; graph/subgraph scope.
- Checkpointer: durable thread and resume; graph/subgraph compile/runtime scope.
- Long-term Store: cross-thread knowledge; graph capability plus Step read/write.

Rules:

- Graph header capability strip shows availability and high-level scope.
- Subgraph header shows inherited or overridden capability.
- Step rail shows only Store read/write when that Step directly accesses the Store.
- Backend, namespace, thread ID, TTL, reducers and schema live in inspector.
- Runtime mode is graph-level unless verified otherwise.

## 7. Provenance and system boundaries

Reference: `provenance-system-boundaries.png`.

Every imported/analyzed element may carry one provenance value:

| Value | Meaning | Canvas treatment |
|---|---|---|
| declared | directly present in graph declaration | normal solid element plus optional evidence chip |
| runtime-generated | created by factory/middleware | dotted blue outline/link |
| derived-semantic | inferred from verified behavior | violet dash-dot relationship/chip |
| external-orchestration | verified outside compiled graph | grey dashed boundary path |

### Opaque/prebuilt

- Show the known interface, factory label and an Opaque badge.
- Do not invent internal topology.
- Runtime introspection may replace the unknown projection later without changing the stored source claim.

### Spawned run

- Use a portal/double-line link to another graph tile.
- Do not include spawned graphs in ordinary path enumeration unless the scenario model explicitly spans runs.

### External orchestration

- Draw outside the compiled-graph boundary.
- Scenario generation must preserve whether a path is native or external.
- Inspector exposes source, confidence, evidence class and why the treatment was chosen.

### Evidence overlay

- Off by default.
- Toggle adds small numbered markers and a compact legend.
- Selecting a marker opens evidence details; it does not change topology.

## 8. Templates, scenarios and proposal review

Reference: `templates-scenarios-human-review.png`.

### Template library

- Use searchable compact rows with tiny topology thumbnails.
- Show concept chips and source inspiration.
- State `Normalized — no source code copied`.
- Ship three challenge templates first: hierarchical research, governed SQL, and specialist support.
- Keep all ten normalized definitions ready for later gallery expansion.

### Scenarios

- Scenario rows expose conditions, ordered path and expected outcome.
- Selecting a scenario highlights its path while fading, not hiding, other branches.
- Runtime-spawned workers remain `×N` in a static contract scenario unless concrete trace data is selected.
- Terminal outcomes are semantic: completed, awaiting reply, failure, partial result, cancelled, or domain-specific equivalent.

### Proposal review

- Reuse existing added, updated, removed and route-changed diff treatments.
- Provide Before and Proposed comparison at overview scale.
- Agent rationale remains visible beside Reject/Approve.
- Approval and freeze are always human-only UI actions.

## 9. Icon contract

Use the installed `@phosphor-icons/react`; prefer current `*Icon` exports. Do not download icons or embed the design boards.

Recommended mapping:

| Meaning | Phosphor icon |
|---|---|
| AI | `RobotIcon` or `BrainIcon` |
| Human | `PersonSimpleIcon` or `HandPalmIcon` |
| HITL | `PauseCircleIcon` |
| Tool | `WrenchIcon` |
| Guardrail | `ShieldCheckIcon` |
| Sensitive | `LockSimpleIcon` with `WarningIcon` where unresolved |
| Store | `DatabaseIcon` plus text `R` or `W` |
| Retry | `ArrowsClockwiseIcon` |
| Opaque | `CubeIcon` / `EyeSlashIcon` |
| Degraded/invalid | `WarningCircleIcon` |
| Send | `GitForkIcon` / `ShareNetworkIcon` |
| Merge | `ArrowsInIcon` / `IntersectIcon` |
| Spawned run | `ArrowSquareOutIcon` |
| External link | `LinkSimpleIcon` |
| Checkpointer | `HardDrivesIcon` / `FloppyDiskIcon` |
| State | `BracketsCurlyIcon` |
| Command | `LightningIcon` |

Use native React Flow/SVG/CSS for geometry: edges, gates, fork lines, joins, loops, boundaries and arrowheads.

## 10. Accessibility and zoom

- Minimum interactive target: 32×32 px; 40×40 px where space permits.
- Every icon has visible text or an accessible name.
- Status is never encoded by color alone.
- Labels remain visible at ordinary editing zoom; compact to icons plus tooltip below the semantic-zoom threshold.
- Keyboard selection reaches nodes, relationships, badges, tabs, response actions and inspector controls.
- Frozen and proposal states retain readable contrast.
- Reduced-motion mode disables animated path or pulse treatments.

## 11. Recommended implementation packages

Do not implement every board in one feature package. Use these independently testable increments:

1. composable Step schema, presets and modifier rail;
2. HITL timing and human-input sheet;
3. Send/map, merge/reducer and cycle-safe scenarios;
4. state/checkpoint/Store scope indicators;
5. template library and scenario highlighting;
6. provenance, opaque topology, spawned runs and external orchestration.

Routing semantics and subgraph foundations remain separate existing packages. Each increment must update domain schemas, migrations, projection, inspector, WebMCP proposal schemas, validation, persistence, export, DOM tests and real-browser QA together.

## 12. Explicit exclusions from the immediate challenge build

- runtime trace animation;
- concrete runtime worker expansion without trace data;
- source-code parsing/import adapters;
- source-line navigation;
- full spawned-run scenario execution;
- external orchestration execution;
- cost, latency and token overlays;
- simulation.

The designs include these future concepts so the core component model will not block them, but the immediate build should prioritize Step composition, HITL, Send/merge, durability scope and three templates.
