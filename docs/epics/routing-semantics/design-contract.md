# Routing semantics design contract

Visual reference: `routing-component-system.png`

## Component grammar

| Semantic type | Rendering | Required data | Created from inventory? |
| --- | --- | --- | --- |
| Edge | Solid charcoal line with target arrow | `source`, `target` | No; connect two nodes |
| Conditional edge | Solid purple line, source branch dot, condition pill | `label`, optional executable `condition` | No; configure an edge |
| Command | Dashed indigo line, lightning chip, route pill | `label`, `destination`, optional `condition` | No; configure an edge |
| Loop | Orange curved return path with label pill | Derived from a connection that returns to an earlier reachable node | No; detected automatically |
| Fallback | Muted dashed purple conditional edge with fallback marker | `label: fallback` | No; configure a conditional edge |

`Loop` is presentation derived from topology, not a separate domain edge type. `Fallback` is a conditional-edge role, not an inventory component.

## Interaction states

- Default: normal semantic styling.
- Hover: slightly stronger stroke and visible hit target; no topology mutation.
- Selected: blue outer glow, stronger stroke, and inspector opened.
- Invalid: red stroke and warning icon; validation message available in the inspector.
- Frozen: muted gray, no handles, no edit controls, semantic label remains readable.

## Edge inspector

The selected edge exposes:

- Type: Edge, Conditional edge, or Command.
- Label.
- Destination, read from the target node.
- Condition for Conditional edge and Command.
- Presentation summary, which is derived and not directly editable.

Every agent-authored edge change remains a proposal until human review. Routing is never represented as a router node.

## Step 2 demo

Use the `Research Intake Routing` workflow shown in the visual reference. This phase includes Edge, Conditional edge, Command, Loop, Fallback, all five interaction states, inspector editing, persistence, validation, freeze behavior, and equivalent WebMCP proposal operations. It excludes parallel workers, merge elements, memory, checkpoints, simulation, and additional node taxonomy.
