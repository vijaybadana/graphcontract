# Lead handover — complete GraphContract visual language

Date: 2026-08-30

## Mission

Implement the complete design system derived from ten verified LangGraph repositories so GraphContract can truthfully represent complex production workflows while remaining understandable to humans and editable through WebMCP.

This is not a request to place every concept on every canvas. The product must use progressive disclosure:

- the canvas shows topology, ownership, concurrency, durability scope, side-effect risk and human authority;
- compact badges show critical modifiers;
- graph/subgraph headers show scoped capabilities;
- inspectors hold detailed configuration;
- optional overlays reveal provenance and runtime projections;
- templates expose realistic complexity only when selected.

## Start condition

Do not mutate the feature tree until all of the following are true:

1. the active routing-semantics package has passed owner review;
2. it is committed;
3. the working tree is clean;
4. its domain and migration shape is treated as the new baseline;
5. all existing tests, lint and production build pass on that exact baseline.

Record the baseline commit before beginning.

## Required reading

- `docs/design-system/README.md`
- `docs/design-system/design-plan.md`
- `docs/design-system/implementation-contract.md`
- all design boards linked by the index, opened at original resolution;
- `research/langgraph-evidence/synthesis.md` from the owner task workspace if available;
- `docs/contracts.md`
- `docs/architecture.md`
- the current post-routing domain, migrations, projection, inspector, WebMCP and scenario code.

## Non-negotiable architecture

### One canonical graph

The accepted domain graph remains the only source of truth. React Flow nodes/edges, collapsed-subgraph proxies, proposal previews, scenario highlights, evidence overlays and runtime instance expansions are projections. Never persist projection-only IDs or geometry as canonical topology.

### Progressive candidate proposals

WebMCP proposal operations are evaluated in order against a copy of the accepted graph. Every reference must exist at the point it is used. The final candidate must validate. Approval applies atomically. Invalid or stale proposals never partially mutate accepted state.

### Human authority

Only explicit human UI actions may:

- approve or reject a graph proposal;
- freeze or unfreeze a contract;
- answer/resume a human-input preview or future runtime gate;
- create user-visible downloads.

WebMCP may read accepted state and submit structured proposals. It may never claim these human actions.

### Backward compatibility

The program changes core taxonomy. Add a deterministic migration from every previously persisted schema, including the post-routing schema. Increment to the next unused schema version after inspecting the baseline; do not guess the version in advance.

Migration must preserve:

- IDs, labels, descriptions and positions;
- subgraph membership and relative coordinates;
- accepted topology and routing semantics;
- HITL data;
- graph status and update timestamps where valid;
- undo/restoration expectations;
- old downloads/imports where the current product promises readability.

New writes use the normalized schema. Legacy node kinds are input compatibility only, not a second active model.

## Target domain semantics

Exact TypeScript names may follow repository conventions, but the following distinctions are mandatory.

### Nodes

Canonical structural kinds:

- Start;
- Step;
- Merge/join junction;
- End/Outcome.

Palette presets create a Step:

- Step — deterministic;
- Agent — AI executor;
- Action — deterministic convenience preset retained for familiar language;
- Tool — registered tool executor;
- Human review — human-owned executor.

A Step must represent these independently:

- primary execution ownership: deterministic, AI, tool or human;
- optional secondary participation, such as an AI Step using internal tools;
- HITL timing and response contract;
- guardrail policy;
- sensitive side-effect policy;
- Store read/write access;
- retry/fallback policy;
- opaque/prebuilt status;
- degraded/unimplemented readiness.

Do not infer deterministic code as a badge. Do not conflate human ownership with HITL. Do not conflate a registered Tool node with a tool called inside an AI Step.

### Relationships

Separate relationship family from routing mode.

Relationship families:

- native control flow;
- spawned run/thread;
- external orchestration.

Native control modes:

- normal;
- conditional;
- fallback;
- Command;
- Send/map.

Loop is derived from return topology and may carry an explicit cap. Fallback remains a conditional role. Spawned runs and external orchestration are never counted as ordinary compiled control edges.

### Send/map and merge

Send/map stores a destination template, dynamic multiplicity semantics and optional payload label/schema reference. Design mode displays one stacked template marked `×N`. Runtime projection may display concrete instances only when runtime evidence exists.

Merge is a first-class non-work junction. It stores/points to reducer semantics and continues once its completion policy is satisfied. Reducer implementation stays in the inspector.

Static scenario enumeration traverses the template once and annotates dynamic multiplicity. It must not fabricate N paths or recurse forever.

### Graph and subgraph capabilities

Represent separately:

- working state/schema and reducers;
- checkpointer/durable thread;
- long-term Store availability;
- runtime mode;
- provenance overlay setting.

Subgraphs inherit capabilities unless an explicit supported override exists. Individual Steps show Store R/W only when they directly access the Store.

### Provenance

Nodes, relationships and subgraphs may carry:

- declared;
- runtime-generated;
- derived-semantic;
- external-orchestration.

Evidence metadata may include source reference, concise summary, confidence and extraction notes. Evidence remains optional for hand-authored graphs. Turning the overlay off must not remove evidence from the graph.

### Outcomes

End is not synonymous with success. Preserve a semantic outcome such as completed, awaiting user reply, partial result, failed, cancelled, escalated or domain-defined equivalent.

## Feature packages

### Package 1 — normalized Step and modifier system

Reference: `docs/design-system/step-component-system.png`.

Build:

- canonical Step/preset/modifier domain shape;
- migration from legacy Agent/Action/Tool/Human kinds;
- palette presets backed by one Step model;
- compact modifier rail with three visible chips and `+N` overflow;
- selected/hover/invalid/frozen/proposal states;
- inspector sections for executor, participation and modifier summaries;
- Phosphor icon mapping from the design contract;
- WebMCP add/update support for normalized Step semantics;
- serialization, import/export and undo/redo coverage.

Acceptance:

- deterministic Step has no redundant badge;
- Agent, Tool and Human review are presets, not incompatible node classes;
- AI + HITL, Tool + HITL + Sensitive and AI + Store R/W combinations render correctly;
- legacy graphs load with identical visible meaning;
- modifier overflow remains accessible from keyboard and inspector;
- proposal diff treatments coexist with semantic states.

### Package 2 — HITL, human control and sensitive effects

Reference: `docs/design-system/human-control-hitl.png`.

Build:

- HITL timing `before`, `inside`, `after`;
- response types approval, text and selection;
- allowed response/outcome configuration and resume destinations;
- visually distinct human-owned Step and HITL modifier;
- gate markers at the correct boundary/timing;
- a deterministic `Preview input request` sheet using contract data, clearly labelled preview rather than live execution;
- sensitive-effect policy including target, authorization, approval required and idempotency;
- scenario branches for configured human outcomes;
- human-only preview response/resume interaction;
- WebMCP proposal support without human-authority tools.

Acceptance:

- the same Step can be AI or Tool executed and still carry HITL;
- before/inside/after are distinguishable by position, icon and accessible label;
- rejecting or requesting changes in preview demonstrates the configured route without mutating runtime state falsely;
- Sensitive does not imply HITL automatically, but validation may require approval when policy says so;
- frozen/proposed graphs cannot bypass authority.

### Package 3 — Send/map, merge/reducer and runtime projection

Reference: `docs/design-system/dynamic-parallelism-merge.png`.

Build:

- Send/map control mode and strict configuration;
- first-class Merge junction;
- design-time `×N` template projection;
- reducer/completion inspector;
- dynamic multiplicity annotations in scenarios and downloads;
- optional runtime-instance projection model that is read-only and only enabled when a trace/fixture supplies instances;
- design/runtime view switch;
- capped refinement loops combined with Send safely;
- validation for missing template, incompatible merge, dangling fork/join and illegal subgraph crossings;
- WebMCP proposal operations/schema for Send and Merge.

Acceptance:

- design mode never fabricates fixed workers;
- runtime instances never alter the accepted graph;
- merge waits/represents dynamic input without becoming a fake Action Step;
- scenario enumeration terminates for Send plus loops and remains deterministic;
- downloads retain multiplicity, payload label and reducer metadata.

### Package 4 — state, checkpoint and Store scope

Reference: `docs/design-system/durability-state-memory.png`.

Build:

- graph-level capability strip;
- subgraph inherited/overridden capability display;
- working-state metadata and reducer summaries;
- checkpointer metadata and durable-thread requirements;
- long-term Store availability plus Step R/W modifiers;
- runtime-mode metadata;
- inspector tabs/sections for State, Checkpoint and Store;
- Retry modifier explicitly separated from actual topology loops;
- validation, persistence, export and WebMCP proposal support.

Acceptance:

- State, Checkpoint and Store are never represented by one generic brain;
- backend details remain inspector-only;
- a Step only shows Store R/W when direct access is declared;
- inherited versus overridden subgraph capability is visible and accessible;
- retry policy does not generate a loop edge.

### Package 5 — provenance, opaque topology and system boundaries

Reference: `docs/design-system/provenance-system-boundaries.png`.

Build:

- provenance metadata and optional evidence overlay;
- declared, runtime-generated, derived-semantic and external treatments;
- Opaque/prebuilt Step status with known interface ports and `Inspect at runtime` disabled/available state based on evidence;
- spawned-run/thread relationship family and portal styling;
- external-orchestration relationship with graph boundary crossing;
- degraded and unimplemented readiness states;
- evidence inspector with representation, source, confidence and native-edge truth;
- scenario/export distinction between native, spawned and external paths;
- WebMCP read/proposal schemas that cannot silently upgrade evidence status.

Acceptance:

- ordinary control, spawned run and external orchestration never share the same line treatment;
- opaque topology never invents child nodes;
- hiding evidence overlay preserves metadata;
- source/evidence fields render safely as untrusted text;
- external paths do not corrupt native graph validation or path enumeration.

### Package 6 — ten-template library, scenario highlighting and proposal review

Reference: `docs/design-system/templates-scenarios-human-review.png`.

Build ten original normalized templates inspired by the evidence corpus:

1. Hierarchical deep research.
2. Guarded coding-agent delivery.
3. Evidence-to-approved social content.
4. Multi-stage expert review.
5. Guarded NL-to-SQL.
6. Memory-aware email triage.
7. Human-approved incident response.
8. Specialist travel support.
9. Stateful voice specialist handoffs.
10. Parallel research with reflection.

Rules:

- copy no repository code or assets;
- use original labels, descriptions, IDs and deterministic fixture data;
- cite source inspiration and state `Normalized — no source code copied`;
- every template must validate under the canonical schema;
- each template must demonstrate a distinct verified pattern;
- loading a template requires confirmation when replacing a non-empty graph and is undoable once.

Also build:

- searchable compact template rows and topology thumbnails;
- concept chips and source note;
- scenario list with conditions, ordered path and expected outcome;
- selected-scenario canvas highlighting while unrelated routes remain faintly visible;
- scenario downloads per case and all cases;
- Design / Scenario / Proposal view switch;
- Before versus Proposed overview and clear rationale;
- human-only Approve/Reject/Freeze actions.

Acceptance:

- all ten templates load, validate, persist, export and reload;
- deterministic scenario snapshots exist for every template;
- scenario highlight is a projection and never mutates accepted topology;
- template search, keyboard navigation and empty state work;
- proposal review still operates for every new semantic element.

### Package 7 — integrated closure and competition demo

Build/verify:

- an end-to-end flagship graph that combines subgraphs, Command, Send ×N, Merge, loop cap, HITL, Sensitive, State/Checkpoint/Store and semantic outcomes without using false provenance;
- a WebMCP-driven proposal that makes a meaningful multi-element change;
- human review, rejection, revised proposal, approval and freeze;
- generated scenarios and downloads;
- responsive behavior, semantic zoom and panel resizing;
- keyboard-only critical flow;
- reduced motion and contrast;
- performance on the most complex template;
- zero uncaught console errors;
- submission screenshots and a deterministic demo script.

Acceptance:

- one concise demo tells the product thesis: an external coding agent edits the same visual contract the human sees, while the human retains authority;
- every shown concept is backed by accepted state or explicit provenance;
- no fake runtime or fake source claim appears;
- the entire suite, lint and production build pass on the committed tree;
- real Chromium closure covers all critical user and WebMCP paths.

## Shared visual rules

- Implement with React Flow, native HTML/CSS/SVG and installed `@phosphor-icons/react`.
- Never embed the PNG boards or download another icon pack.
- Preserve warm white canvas, near-black text, fine borders, restrained shadows and semantic colors.
- Use shape, icon, stroke and label together; color is never the only signal.
- Normal nodes remain compact. Show no more than three modifier chips before `+N`.
- Inspectors use progressive disclosure and do not become a permanent wall of configuration.
- Frozen state reduces editing affordance without making content illegible.
- Respect reduced-motion preferences.

## Shared validation rules

In addition to existing structural validation:

- every Step has valid execution semantics;
- every HITL gate has timing and valid response contract;
- Sensitive policy fields are internally consistent;
- Send has a valid template destination and compatible Merge when required;
- loops have cycle-safe scenario behavior and optional nonnegative caps;
- graph/subgraph capability inheritance is valid;
- Store R/W requires Store availability in effective scope;
- spawned/external relationships cannot masquerade as native control;
- provenance enum and confidence are valid without requiring evidence on hand-authored graphs;
- semantic Outcome labels are non-empty.

Validation must produce stable codes, actionable paths and human-readable messages used consistently by UI and WebMCP.

## Shared test matrix

Every package must include proportional coverage for:

- Zod/domain parsing and invalid cases;
- migrations from all previous persisted versions;
- application operations and atomic proposal behavior;
- Zustand history/persistence and undo/redo;
- React Flow projection, collapsed subgraphs and selection;
- DOM component states and accessibility names;
- inspector editing and frozen/proposal locks;
- WebMCP input schemas, tool descriptions, successful proposals and structured errors;
- scenario enumeration, determinism, cycles and downloads;
- lint and production build;
- real Chromium creation/editing/reload/freeze/proposal/download journeys.

## Git and ownership discipline

- Preserve unrelated user work.
- Never bypass a dirty shared working tree.
- One owner-reviewed commit per package; smaller internal commits are allowed.
- Record exact baseline and final hashes.
- Never manually alter shared Gastown/Beads/Dolt state as a feature workaround.
- Do not begin the next package with unresolved attention, failed checks or an unclean tree.

## Completion report required from lead

For each package, ping the owner task with:

- package name and user-visible result;
- domain/schema/migration decisions;
- files changed;
- tests, lint and build commands/results;
- real-browser journeys and evidence;
- accessibility/performance notes;
- remaining risks or intentionally deferred details;
- commit hash and clean-tree confirmation.
