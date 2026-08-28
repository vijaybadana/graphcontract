# GraphContract Architecture

## Purpose

GraphContract is a browser-based, human-controlled workspace for designing agent workflows. A person edits a workflow visually; an external coding agent accesses the same workflow through WebMCP and may propose structured changes. The person alone accepts, rejects, or freezes those changes.

## MVP architecture

GraphContract is frontend-first:

- React + TypeScript application
- React Flow canvas for workflow editing
- Zustand (or equivalent) for in-memory UI state
- Zod (or equivalent) for runtime validation
- Browser `localStorage` for project persistence
- Native WebMCP registration via `document.modelContext.registerTool(...)`
- Client-side generation of graph-contract and test-scenario downloads
- ChatGPT Sites deployment as a public static/server-capable host

The MVP deliberately has no required backend. A deployed site remains available when the developer's computer is offline.

## Layers

The implementation mirrors these boundaries directly:

```text
src/domain        Canonical graph model, validation, operations, scenarios
src/application   Framework-free workspace use cases and authority rules
src/state         Zustand persistence and interaction history adapter
src/adapters      React Flow projection, WebMCP registration, file exports
src/features      Canvas, inspector, proposal, scenario, and workspace UI
```

Both the human interface and WebMCP adapter enter through the same application/state actions. React Flow data is a projection of the canonical domain graph, not a second graph model.

### Graph domain layer

Owns the canonical accepted workflow:

- Nodes, edges, positions, labels, and optional embedded HITL configuration
- Structural validation: IDs, routing constraints, reachability, and acyclicity
- Import/export serialization
- Path enumeration after the graph is frozen

### Editor and interaction layer

Owns human-facing visual interaction:

- Palette and canvas editing
- Node and edge configuration panels
- Validation feedback
- Freeze/confirm controls
- Generated scenario and download panels

Human edits update the accepted graph directly, subject to validation.

### Proposal layer

Owns agent-initiated change review:

- Receives structured graph operations and a rationale through WebMCP
- Validates operations against the current graph
- Produces a non-destructive proposed graph and visual diff
- Supports human approval or rejection
- Applies approved operations atomically to the accepted graph

Only one active proposal should exist in the MVP. A new proposal is rejected while another proposal is pending.

### WebMCP integration layer

Registers browser-native tools for an external agent:

- `get_graph`
- `propose_graph_changes`
- `get_branch_scenarios`

Tools expose structured data only. They do not simulate UI actions, mutate human authority state, or grant confirmation privileges to the agent.

### Scenario and export layer

After a human freezes a valid graph, this layer:

- Enumerates every reachable start-to-terminal path
- Produces branch conditions, ordered node paths, expected nodes, and terminal node expectations
- Exports JSON artifacts and a generated Python test skeleton

## State model

```text
accepted graph ──human edits──> accepted graph
      │
      ├──agent proposal──> pending proposal + visual diff
      │                         │
      │                         ├──human approves──> accepted graph
      │                         └──human rejects───> accepted graph unchanged
      │
      └──human freezes──> frozen graph ──> scenarios + downloads
```

A frozen graph is immutable in normal UI flow. The user must explicitly unfreeze or duplicate it before further editing, if that capability is added.

## Persistence

`localStorage` stores the current accepted graph, pending proposal metadata, and frozen state on the local browser/device. No account, authentication, or server-side project database is needed for the MVP.

Persisted data is convenience storage, not a collaboration or security mechanism. The page remains fully functional when storage is empty by loading the predefined sample graph.

## Optional D1 boundary

A ChatGPT Sites D1 backend may be added only when a later requirement needs durable server-side projects, sharing, cross-device access, audit history, or collaboration beyond one browser.

If added:

- The browser remains the primary graph editor and WebMCP host.
- The graph and proposal schemas remain the shared contract.
- Server APIs validate payloads before persistence.
- Human approval/freeze authority remains enforced in browser-visible product logic and server validation.
- D1 must not become required for the core demo unless the deployment spike proves it reliable.

## Trust and authority boundary

The agent is a proposer, never an approver.

An external agent may:

- Read the current accepted graph
- Request branch scenarios for a frozen graph
- Submit a structured proposal with rationale

An external agent may not:

- Directly mutate the accepted graph
- Approve, reject, save, confirm, freeze, unfreeze, or export on the user's behalf
- Override validation rules
- Access any data outside the graph contract exposed by the registered tools

The browser UI presents the proposal diff and requires an explicit human action before accepted state changes.

## Deployment

ChatGPT Sites hosts the public application. The initial deployment should verify:

- The public URL works without a local development server
- WebMCP tools register and are discoverable in a supported browser or client
- LocalStorage behavior is appropriate for the demo
- Downloads work from the hosted URL

## Non-goals

The MVP does not include repository parsing, agent-code generation, implementation verification, authentication, loops or retries, parallel branches, subgraphs, LangSmith integration, or an embedded chatbot.
