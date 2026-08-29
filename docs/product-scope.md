# GraphContract — Product Scope

## Objective

GraphContract is a browser-based visual editor where a human and an external coding agent collaboratively design a workflow. The human edits the workflow directly; the agent reads it through WebMCP and proposes structured changes. The human alone approves, rejects, and freezes the final workflow.

The final frozen workflow becomes a portable execution contract with bounded deterministic branch scenarios and downloadable testing artifacts.

## Primary judge journey

1. Open the public GraphContract URL.
2. See a predefined workflow on an editable visual canvas.
3. Make one small change manually, such as adding a node or connection.
4. Ask an external WebMCP-capable agent to inspect the graph and propose a change.
5. See the proposal as a clear node/edge diff on the canvas.
6. Approve or reject the proposal from the UI.
7. Freeze the accepted workflow.
8. Review every reachable execution path generated from the frozen graph.
9. Download the graph contract and generated test scenarios.

The entire journey should be understandable and demonstrable in under three minutes.

## MVP requirements

- A browser-based, publicly accessible application.
- An editable directed workflow canvas with a node palette.
- A predefined support-workflow-style demo graph.
- Human creation, movement, configuration, and connection of workflow elements.
- Validated graph routing:
  - One normal outgoing edge; Command routes; or conditional outgoing edges with unique labels.
  - Optional fallback branch where applicable, normalized as `fallback` with no condition.
  - No mixing normal and routed outgoing edges on one node.
  - Return loops derived from topology; each is traversed at most once per generated path.
- Support for the intended workflow concepts, provisionally:
  - Start, Agent, Action/function, Tool, Human Input, End.
  - Optional embedded human-in-the-loop metadata on applicable nodes.
- Native WebMCP tools registered in the page:
  - `get_graph`
  - `propose_graph_changes`
  - `get_branch_scenarios`
- Structured agent proposals that do not alter the accepted graph until a human approves them.
- Visible proposal diff and human approve/reject controls.
- Human-only freeze/confirm action.
- Bounded deterministic reachable-path generation after freeze.
- Downloadable contract and scenario artifacts; a generated Python test skeleton is desirable for the core demo.
- Local persistence suitable for the MVP, with no login required.
- Clear error states for invalid graph edits, invalid proposals, and frozen-graph restrictions.

## Authority model

- Human: edits the accepted graph, approves or rejects proposals, freezes the graph, and downloads outputs.
- External agent: reads the current graph and submits structured proposals only.
- Application: validates edits and proposals, computes paths, and generates exports.
- No agent action may approve, reject, freeze, save over, or otherwise finalize a proposal.

## Non-goals

- Importing or parsing repositories.
- Generating or executing production agent code.
- Verifying an implementation against a repository.
- Authentication, multi-user collaboration, or a production database.
- Retry execution, parallel execution, or deeply nested subgraphs.
- Embedded chat UI.
- LangSmith integration.
- Claims of LangGraph runtime compatibility beyond the exported, LangGraph-style workflow contract.

## Success criteria

A judge can:

- Manually modify a workflow.
- Use a WebMCP-capable external agent to propose a valid graph change.
- Clearly distinguish proposal state from accepted state.
- Approve or reject the proposal themselves.
- Freeze a valid workflow.
- Inspect bounded deterministic branch scenarios.
- Download useful, valid artifacts.
- Understand why WebMCP is central to the experience.

The public application, source repository, README, and demo video must all be ready before submission.

## Change control

This document fixes the product outcome, not every implementation detail.

The following may change during implementation if they preserve the objective and judge journey:

- Exact node types, labels, styling, and default demo graph.
- Library choices and component structure.
- Proposal operation schema and export file shape.
- Persistence method and deployment implementation.
- Validation wording and scenario presentation.

Any change that weakens human approval authority, removes real WebMCP interaction, prevents bounded deterministic path generation, or makes the core journey harder to demonstrate requires an explicit scope decision before implementation.
