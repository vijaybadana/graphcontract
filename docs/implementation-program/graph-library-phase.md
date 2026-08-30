# Graph Library + source attribution phase

## Outcome

Add a searchable Graph Library where a user can inspect ten evidence-backed workflow templates, open the inspiring GitHub repository, and load any template onto the existing canvas. Every entry is an original GraphContract normalization: no repository code, graph IDs, labels, assets, screenshots, or fixture data are copied.

This phase is the first of the two remaining competition phases. Competition closure remains locked.

## Frozen scope

### Registry

Create one typed, data-driven registry. A library entry must contain:

- stable `id`;
- original title and concise practical outcome;
- domain, complexity and concept chips;
- repository owner/name and canonical HTTPS URL;
- the visible attribution `Inspired by <owner/repo>`;
- the visible disclaimer `Normalized — no source code copied`;
- a canonical schema-v6 `WorkflowGraph` factory or immutable fixture;
- deterministic scenario summary data derived through the ordinary scenario service;
- compact topology-thumbnail data derived from the graph rather than a copied image.

Repository metadata is display-only, safely rendered as untrusted text. Only explicit `https://github.com/...` links are allowed. External links open in a new tab with `noopener noreferrer`. Repository links must never load or mutate a graph.

### Ten entries

| # | Original GraphContract template | Source inspiration |
|---|---|---|
| 1 | Hierarchical Deep Research | [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) |
| 2 | Guarded Coding-Agent Delivery | [langchain-ai/open-swe](https://github.com/langchain-ai/open-swe) |
| 3 | Evidence-to-Approved Social Content | [CopilotKit/open-fullstack-social-media-agent](https://github.com/CopilotKit/open-fullstack-social-media-agent) |
| 4 | Multi-Stage Expert Review | [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) |
| 5 | Guarded Natural-Language-to-SQL | [tharunramavath/AI-Powered-SQL-Agent](https://github.com/tharunramavath/AI-Powered-SQL-Agent) |
| 6 | Email Triage with Human Review | [langchain-ai/agents-from-scratch-ts](https://github.com/langchain-ai/agents-from-scratch-ts) |
| 7 | Human-Approved Incident Response | [AttiR/OpsCanvas](https://github.com/AttiR/OpsCanvas) |
| 8 | Specialist Travel Support | [ro-anderson/multi-agent-rag-customer-support](https://github.com/ro-anderson/multi-agent-rag-customer-support) |
| 9 | Voice Specialist Handoffs | [langchain-ai/pipecat-langgraph-example](https://github.com/langchain-ai/pipecat-langgraph-example) |
| 10 | Parallel Research with Reflection | [google-gemini/gemini-fullstack-langgraph-quickstart](https://github.com/google-gemini/gemini-fullstack-langgraph-quickstart) |

Use the evidence corpus at `/Users/vijaybadana/Documents/Codex/2026-08-27/what-are-some-interesting-opportunities-to-2/research/langgraph-evidence/`, especially `selection.md`, `owner-graphs.md`, `finance-sql.md`, `hitl-ops.md`, `product-graphs.md`, and `synthesis.md`. Evidence informs topology only. Do not copy source implementation.

Where a repository demonstrates a durability concept, normalize only verified schema-v6 State, Checkpointer, Store, runtime-mode, and direct Step Store access records. Describe omitted or unresolved behavior in the source note; never fabricate a checkpointer, Store access, opaque topology, spawned run, external orchestration, live execution, or runtime evidence.

Existing built-in demos may become registry entries or provide validated graph foundations when their meaning matches. Remove duplicated demo buttons once every equivalent workflow is reachable from the library. Preserve current demo IDs and migrations when changing them would break saved-state compatibility.

### Library user experience

- Add a clear top-level `Graph library` control with an entry count.
- Open a dedicated responsive drawer/sheet, not a dense expansion inside the component palette.
- Provide search across title, repository, domain, outcome and concepts.
- Provide compact domain/concept filters and a useful no-results state.
- Each row/card shows an original topology thumbnail, title, outcome, concept chips, complexity, source attribution, repository link and `Open graph` action.
- Card activation or `Open graph` loads the graph. The repository link only opens GitHub.
- Replacing a non-empty graph requires explicit confirmation and is one-step undoable.
- Loading uses the ordinary application/store boundary, clears stale runtime projection and transient preview state, selects nothing stale, fits the graph, and preserves proposal/frozen authority rules.
- A pending proposal or frozen graph blocks library replacement. The UI explains why.
- The loaded entry is visibly identified without introducing an account, database, backend, or network dependency.
- Keyboard navigation, focus restoration, accessible names, reduced motion and 390/768/1024/1440 layouts remain supported.

### Template quality

Every graph must:

- parse and validate under canonical schema v6;
- use original IDs, labels, positions, descriptions and deterministic data;
- demonstrate a distinct topology/pattern supported by Packages 1–3;
- preserve Start/End, routing, subgraph, Step, HITL, Send/Merge and loop invariants as applicable;
- produce deterministic bounded scenarios through the ordinary service;
- load, persist, export, reload and undo through production code;
- remain editable after loading and respect freeze/proposal locks;
- fit legibly without overlapping nodes or unreadable edge labels at desktop width.

The registry must reject duplicate IDs, unsafe source URLs and invalid graphs in tests. Do not fetch GitHub at runtime.

## Explicit exclusions

- No Package 5 provenance/system-boundary schema or fabricated runtime evidence.
- No full Package 5 provenance overlay, opaque topology, spawned-run or external-orchestration relationship.
- No live GitHub import, repository parsing, authentication, API, stars, popularity ranking or network fetch.
- No copied repository code/assets or claims that the normalized graph is the repository's exact runtime graph.
- No scenario-canvas highlighting, Before/Proposed overview, submission screenshots, landing-page redesign or deployment work; these belong to competition closure.
- Do not change the exactly-three-tool WebMCP authority contract. Library browsing/loading is human UI, not a new agent authority tool.

## Suggested implementation seams

1. **GL-D — registry and ten fixtures:** types, metadata validation, ten original graphs, deterministic scenarios, export/reload tests.
2. **GL-U — library UI:** drawer, search/filter, thumbnails, source links, accessibility and responsive layout.
3. **GL-I — application integration:** confirmation, load/undo/persistence, Fit, transient-state cleanup, frozen/pending locks, migrate existing demo entry points.
4. **GL-Q — acceptance:** focused browser journeys and complete regression closure.

Use direct clean commits and owner acceptance. Do not initialize Gastown/lead-schedule or modify shared Beads/Dolt state.

## Acceptance gate

- Exactly ten intended library entries are visible and searchable.
- All ten graphs validate, generate deterministic bounded scenarios, round-trip through persistence/export and have unique IDs.
- Each card links to the correct GitHub repository and displays `Normalized — no source code copied`.
- Loading every entry succeeds; representative simple, HITL, subgraph and Send/Merge entries are browser-verified visually.
- Replacement confirmation, Cancel, Open, Undo, reload and Fit work.
- Repository-link activation leaves the accepted graph unchanged.
- Frozen and pending-proposal states block replacement; WebMCP remains exactly three review-only tools.
- Existing Packages 1–3 behavior and all 51 Playwright cases remain green.
- Add only distinct browser cases for library open/search/filter/empty state, keyboard/source link, load-confirm-cancel-undo, all-entry validation, authority locks and responsive drawer behavior.
- Full Vitest, warning-free ESLint, production build and `git diff --check` pass.
- Cold Chromium has zero skip/fixme/only and zero unexpected console warning/error/pageerror.
- Working tree is clean and a manual library-review checklist is recorded.
