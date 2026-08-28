# GraphContract — Implementation Checklist

## 0. Project foundation

- [x] Create an independent GraphContract workspace outside UGC/Manki projects.
- [x] Create a new public GitHub repository.
- [x] Add MIT License, `.gitignore`, README, and initial commit.
- [x] Confirm the repository is publicly accessible and license detection works.
- [x] Record the project as new work begun for this challenge.

**Verify:** A fresh browser session can open the repository and see source, README, and license.

## 1. Hosting and WebMCP spike

- [x] Create a minimal TypeScript web application.
- [x] Install and configure the ChatGPT Sites scaffold.
- [x] Deploy it to ChatGPT Sites and enable public access.
- [x] Confirm the deployed URL works independently of local development.
- [x] Register one minimal native read-only `get_graph` WebMCP tool in the page.
- [x] Build-test the initial WebMCP registration.
- [ ] Verify production tool discovery and invocation using the intended WebMCP-capable client.

**Verify:** A public, non-localhost URL loads and exposes a working WebMCP tool.

## 2. Product contracts

- [ ] Define TypeScript schemas for graph, nodes, edges, routing, HITL metadata, proposals, operations, validation errors, frozen state, and scenarios.
- [ ] Define graph invariants, including acyclic routing and conditional-label rules.
- [ ] Define proposal constraints: proposals can never directly mutate accepted state.
- [ ] Define export schemas for graph contract, scenarios, and Python test skeleton.
- [ ] Add representative fixtures for the initial demo workflow.

**Verify:** Valid and invalid graph or proposal fixtures produce expected validation outcomes.

## 3. Canvas and human editing

- [ ] Add node palette and visual workflow canvas.
- [ ] Render the initial predefined workflow.
- [ ] Support dragging nodes and connecting edges.
- [ ] Add node and edge configuration controls.
- [ ] Surface validation feedback without losing valid user work.
- [ ] Add clear accepted, proposed, and frozen visual states.

**Verify:** A human can reproduce the planned manual-edit portion of the demo without errors.

## 4. WebMCP integration

- [x] Register `get_graph` in an initial read-only form.
- [ ] Complete the production `get_graph` contract against live editor state.
- [ ] Register `propose_graph_changes`.
- [ ] Register `get_branch_scenarios`.
- [ ] Validate all agent-supplied operations before storing a proposal.
- [ ] Return clear structured success and error responses.
- [ ] Ensure no WebMCP tool can approve, reject, freeze, or silently apply changes.

**Verify:** An external agent can inspect the graph and submit both a valid proposal and an intentionally invalid proposal.

## 5. Proposal review experience

- [ ] Store at most the intended active proposal state.
- [ ] Render proposed nodes, edges, and modifications distinctly on the canvas.
- [ ] Show the agent rationale and operation summary.
- [ ] Implement human-only Approve and Reject controls.
- [ ] Apply accepted operations atomically on approval.
- [ ] Remove proposal state on rejection.
- [ ] Prevent proposal actions after the graph is frozen.

**Verify:** The full agent-proposal → human-review → approval or rejection flow is visually obvious and correct.

## 6. Freeze and scenario generation

- [ ] Implement human-only freeze or confirm action.
- [ ] Prevent further accepted-graph editing after freeze.
- [ ] Enumerate every reachable Start-to-End path.
- [ ] Include ordered nodes, triggering conditions, expected nodes, and terminal node in each scenario.
- [ ] Present scenarios clearly in the application.

**Verify:** The predefined conditional demo graph generates the expected number and content of scenarios.

## 7. Exports and persistence

- [ ] Generate and download `graph-contract.json`.
- [ ] Generate and download `graph-test-scenarios.json`.
- [ ] Generate and download `test_graph_paths.py`.
- [ ] Persist appropriate MVP state locally.
- [ ] Handle reset and new-session behavior intentionally.

**Verify:** Downloaded JSON parses correctly and Python output is syntactically valid.

## 8. Quality and accessibility pass

- [ ] Add automated tests for validation, operation application, path enumeration, and export generation.
- [ ] Test the essential human flow in a real browser.
- [ ] Check keyboard access, visible focus, readable labels, and color-independent proposal status.
- [ ] Test empty, invalid, pending, rejected, approved, and frozen states.
- [ ] Check responsive behavior at demo-friendly desktop and laptop sizes.

**Verify:** Tests pass and the judge journey works from a clean session.

## 9. Deployment and public proof

- [x] Deploy the initial app to ChatGPT Sites.
- [ ] Deploy the completed app to ChatGPT Sites.
- [ ] Confirm production URL uses no local services or secrets exposed to the browser.
- [x] Confirm the initial deployment remains available with local development stopped.
- [ ] Test completed WebMCP functionality on production, not only locally.
- [ ] Add the public URL and repository URL to the Devpost draft.

**Verify:** A fresh, logged-out or clean-browser visit can complete the core flow.

## 10. Repository and documentation

- [ ] Write a judge-friendly README:
  - [ ] What GraphContract does.
  - [ ] Why WebMCP is essential.
  - [ ] Architecture and authority model.
  - [ ] Local setup and testing instructions.
  - [ ] WebMCP tool reference.
  - [ ] Deployment and known MVP limits.
- [ ] Add screenshots or a short GIF if helpful.
- [x] Confirm source and MIT license are public.
- [ ] Confirm all required setup files are public.
- [ ] Keep commit history clear and challenge-period work traceable.

**Verify:** A new developer can understand and run the project from the README.

## 11. Demo video and Devpost readiness

- [ ] Draft a demo script under three minutes.
- [ ] Record with clear audio:
  - [ ] Product problem and promise.
  - [ ] Human graph edit.
  - [ ] External agent WebMCP proposal.
  - [ ] Visual review and human approval.
  - [ ] Freeze, generated scenarios, and downloads.
- [ ] Upload as a public YouTube video and confirm playback.
- [ ] Complete Devpost description, built-with technologies, URLs, images, and required form answers.
- [ ] Explain the WebMCP implementation and user benefit plainly.
- [ ] Complete final live URL, repository, and video validation.
- [ ] Obtain explicit user confirmation immediately before actual submission.

**Verify:** All links work publicly, the video is under three minutes, and the Devpost draft contains no placeholders.

## 12. Submission freeze

- [ ] Submit ahead of the official deadline.
- [ ] Save final URLs and submission confirmation.
- [ ] Do not alter the submitted deployment, repository, or Devpost entry after the deadline; use a separate fork for subsequent work if needed.

**Verify:** Devpost shows the project as submitted and all required public assets remain accessible.
