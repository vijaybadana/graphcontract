# GraphContract — Devpost submission draft

> Local preparation document for The WebMCP Challenge. Replace every `TODO` before submitting. This file does not submit or update the Devpost project.

## Project identity

- **Project:** GraphContract
- **Tagline:** Design agent behavior together—before it becomes code.
- **Submitter type:** Individual
- **App status:** New
- **Live app:** https://graphcontract.dev/
- **Public source repository:** https://github.com/vijaybadana/graphcontract
- **Devpost draft:** https://devpost.com/software/graphcontract
- **Demo video:** TODO — public YouTube URL, less than three minutes, with audio

## Short description

GraphContract is a human-governed planning layer for agent systems. A coding agent uses WebMCP to read an accepted visual contract, propose structured graph changes, and derive deterministic scenarios. The human reviews the visual diff, requests revisions, approves or rejects the proposal, and freezes the final contract before implementation.

## Inspiration

Agent behavior is usually scattered across prompts, source code, framework configuration, and runtime traces. By the time a human can review the complete workflow, important choices—branching, tool use, parallelism, approval gates, loops, and failure paths—have already become implementation details.

GraphContract starts one step earlier. It gives people and coding agents a shared visual language for agreeing on intended behavior before code is written.

## What it does

GraphContract provides a visual canvas for designing agent workflows with typed nodes, routing semantics, nested subgraphs, human-in-the-loop gates, sensitive-effect policies, dynamic `Send ×N` work, Merge junctions, and bounded loops.

A browser-capable coding agent can:

1. Read the accepted contract through `get_graph`.
2. Submit a structured candidate through `propose_graph_changes`.
3. Read deterministic paths through `get_branch_scenarios`.

The agent cannot directly alter accepted truth. The proposed candidate is rendered for human review, and only the person using the UI can request changes, approve, reject, freeze, unfreeze, or download the handoff. After approval, GraphContract derives deterministic scenarios that can be focused on the canvas. The final contract can be frozen and downloaded as graph JSON, scenario JSON, and Python path-test scaffolding.

## Why this is a strong fit for WebMCP

Graph editing through screenshots, cursor automation, or natural-language guesses is fragile. A graph has identity, revision, topology, validation rules, and authority boundaries that an agent should not infer from pixels.

WebMCP gives GraphContract a small, typed browser-native contract. The agent receives the accepted graph as structured data and submits explicit operations against a known revision. GraphContract validates the complete candidate atomically and presents it as a visual proposal. This makes the agent faster and more reliable while preserving a clear rule: the agent may propose intent, but the human owns acceptance.

## What became possible

Before GraphContract, a user could ask a coding agent to implement a workflow, but reviewing its full behavioral contract meant reading code and framework-specific files after the fact. With GraphContract, the user and agent can negotiate that behavior visually before implementation:

- start from a reusable real-world workflow pattern;
- ask the agent to adapt it for a specific use case;
- inspect exactly what the proposal adds, changes, or removes;
- request a safety revision such as approval before a paid or irreversible tool action;
- review every deterministic route;
- freeze the accepted contract; and
- hand structured artifacts back to the coding agent for implementation.

## How WebMCP is implemented

GraphContract registers exactly three tools with `document.modelContext.registerTool(...)`:

- `get_graph` returns the accepted graph, revision identity, validation state, and outstanding human review request.
- `propose_graph_changes` accepts typed graph operations plus the expected graph revision and builds a review-only candidate. Operations are applied progressively to the candidate, then the completed graph is validated atomically. The accepted graph is not mutated until human approval in the UI.
- `get_branch_scenarios` returns deterministic scenarios derived from the accepted contract.

The proposal schema covers graph topology, typed routing, nested subgraphs, provenance, HITL gates, sensitive effects, state/checkpoint/store capability records, and external orchestration boundaries. It deliberately exposes no approval, rejection, freeze, runtime-control, library-loading, or download authority.

## Demo journey

1. Open GraphContract and choose a hierarchical research workflow from the Library.
2. Ask Codex to adapt the accepted contract into an Enterprise Account Research Agent that researches a target company, discovers decision-makers and buying signals, evaluates product fit, and produces an evidence-backed account brief with a recommended next action.
3. Codex calls `get_graph` and submits a structured proposal through `propose_graph_changes`.
4. Inspect the proposed topology and visual change summary.
5. Request one practical revision: require human approval before paid enrichment or any CRM update.
6. Inspect and approve the revised candidate.
7. Freeze the contract and review its deterministic scenario paths on the canvas.
8. Download the contract and handoff artifacts.
9. Open Runtime preview to show how dynamic `Send ×N` instances map back to the frozen design without becoming editable contract nodes.

## How we built it

- React 19 and TypeScript
- React Flow for the canvas projection and interaction layer
- Zustand for local workspace state and persistence
- Zod for schema validation and migration boundaries
- Native browser WebMCP registration through `document.modelContext.registerTool(...)`
- Vitest and Testing Library for domain, state, projection, and DOM contracts
- Playwright for cold-browser acceptance journeys using the real registered WebMCP tools
- Netlify for the public deployment and custom domain

## Challenges

The hardest part was not drawing nodes. It was making a graph-editing experience truthful under collaboration. We had to preserve one accepted graph while rendering a separate proposal candidate; validate topology and human-control policies without granting the agent approval authority; derive bounded deterministic scenarios from loops and dynamic parallelism; and keep runtime observations separate from design-time contract state.

We also treated browser behavior as part of the product contract. The Playwright suite exercises proposal review, frozen-state protection, persistence, scenario focus, downloads, accessibility, responsive behavior, and the actual page-registered WebMCP tools.

## Accomplishments

- A complete human–agent planning lifecycle rather than a single tool-call demo.
- Exactly three purposeful WebMCP tools with a narrow, documented authority boundary.
- Typed agent proposals that never mutate accepted state before human approval.
- First-class HITL, sensitive effects, conditional and fallback routing, bounded loops, nested subgraphs, `Send ×N`, Merge, deterministic scenarios, and runtime projection.
- A portable agent skill published from the site so browser-capable coding agents can follow the lifecycle consistently.
- Downloadable contract and test handoff artifacts that connect planning to implementation.

## What we learned

The most useful human–agent interfaces do not maximize agent authority. They make authority legible. WebMCP works especially well when it exposes the smallest structured surface the agent needs and lets the web application keep validation, review, and consequential actions visible to the person.

We also learned that a visual graph can serve as more than documentation. With stable identities, typed edges, revision checks, derived scenarios, and explicit approval state, it becomes an executable agreement between human intent and agent implementation.

## What's next

- Turn frozen contracts into framework-specific implementation adapters.
- Add repository-linked contract versioning and graph diffs in CI.
- Accept trusted runtime events and highlight live execution against the frozen contract.
- Expand the reusable graph library with source-backed agent patterns.
- Add authenticated, isolated workspaces and team collaboration after the hackathon build.

## Testing instructions for judges

1. Open https://graphcontract.dev/ in ChatGPT's in-app browser. Alternatively, use Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
2. Confirm that the page exposes exactly `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`.
3. Open **Library** and load a graph.
4. Ask the agent to read the current graph and propose a small, valid change. The accepted graph must remain unchanged while the proposal is pending.
5. Inspect the Proposal view and approve or reject it in the UI. These actions are intentionally not available through WebMCP.
6. Freeze the accepted graph, open Scenario mode, focus a path, and download the available artifacts.

No account or credentials are required for the hackathon build.

## Judging alignment

### WebMCP Leverage

WebMCP is the collaboration boundary, not a decorative integration. The three native tools cover reading accepted intent, proposing a validated revision, and deriving scenarios. Revision identity, atomic validation, and human-only authority make the integration non-trivial and product-critical.

### Execution

The submission is a coherent browser product: reusable graph library, visual authoring, proposal comparison, request-changes flow, approval/rejection, freeze protection, scenario focus, downloads, and runtime projection. Automated browser journeys exercise the real registered tools and the surrounding human interface.

### Potential Impact

The target audience is anyone designing non-trivial agent workflows with coding agents. GraphContract moves review before implementation, where correcting an unsafe branch or missing approval gate is cheaper and easier to understand.

### Creativity & Ambition

GraphContract treats a visual graph as a negotiated, versioned behavioral contract between a person and an agent—not merely a diagram or a post-execution trace. It combines structured agent proposals, human authority, deterministic scenario derivation, and implementation handoff in one browser-native workflow.

## Official submission facts

- **Submission deadline:** September 3, 2026 at 1:00 PM Pacific Time (September 4, 2026 at 1:30 AM IST).
- **Video:** public YouTube link, less than three minutes, with audio explaining the product and its WebMCP use. Judges are not required to watch beyond three minutes.
- **Live access:** must remain free and accessible to judges through the end of judging.
- **Source:** public GitHub, GitLab, or Bitbucket repository containing the functional source, assets, setup instructions, and a detectable open-source license.
- **Best material first:** the official guidance recommends showing the working product within the first 15 seconds and removing setup, loading, dead air, and live-typing delays.

## Required Devpost fields

Use this section as a form-entry checklist. Values marked `TODO` require the submitter's confirmation.

| Devpost field | Draft answer |
| --- | --- |
| Submitter Type | TODO — confirm Individual, Team of Individuals, or Organization |
| Country of residence | TODO — select the submitter's actual country |
| Organization name | Not applicable |
| App Status | New |
| Existing-project changes | Not applicable |
| Live URL | https://graphcontract.dev/ |
| Testing instructions / credentials | Use the testing instructions above; no credentials required. |
| Public code repo | https://github.com/vijaybadana/graphcontract |
| Agents or clients tested | Codex in-app browser; Playwright Chromium executing the real page-registered WebMCP tools. Update after the final production browser pass. |
| AI tools used | Codex for implementation, research, testing, and documentation; TODO — add any other tools actually used. |
| Learning derived | Significant |
| Gained reusable AI career value | Yes |
| Demo video | TODO — public YouTube URL under three minutes with audio |

## Readiness checklist

- [x] Devpost project exists as a submission draft.
- [x] Registered for The WebMCP Challenge.
- [x] Live application URL selected.
- [x] Public repository URL selected.
- [x] MIT license exists in the repository.
- [x] README includes setup, verification, product explanation, and WebMCP implementation.
- [ ] Verify the final production build in ChatGPT's in-app browser.
- [ ] Verify all three WebMCP tools on the final production deployment.
- [ ] Record a clear demo with audio and visible product behavior in the first 15 seconds.
- [ ] Upload the demo publicly to YouTube and add its URL.
- [ ] Review and personalize this text; do not submit it verbatim without a human edit.
- [ ] Confirm the repository is publicly accessible in an incognito window.
- [ ] Confirm the MIT license is detected in the repository About section.
- [ ] Confirm every team member is added, if applicable.
- [ ] Complete every required Devpost field and submit before the deadline.

### ⏳ Not submitted yet
Nothing has been sent to Devpost.
