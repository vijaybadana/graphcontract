# Lifecycle reference

Use this reference when a concrete transition example helps explain what the agent should do next.

## State transition

```text
DISCOVER -> PLAN -> REVIEW
                       | request changes -> REVISE -> REVIEW
                       | reject          -> STOP
                       ` approve         -> FREEZE -> HANDOFF
```

Agent-owned actions: Discover, Plan, Revise, Handoff.

Human-only actions: Review outcomes and Freeze.

`STATUS` may describe the current state but does not advance it.

## Travel-booking example

1. **Discover:** inspect the travel application repository with the coding agent's own repository access, then call `get_graph` on the open GraphContract canvas.
2. **Plan:** propose `Start -> Trip Planner -> Flight Search -> Human Booking Approval -> Book Trip -> End`, including failure or fallback routes required by the brief. Stop for review.
3. **Request changes:** the human asks for a budget-limit branch before booking.
4. **Revise:** after the prior proposal is cleared, refresh the accepted graph and propose the budget branch. Explain the impact and stop for review again.
5. **Approve and Freeze:** the human approves the proposal and separately freezes the accepted graph in the portal.
6. **Handoff:** verify frozen status, retrieve deterministic branch scenarios, and implement only the frozen contract. If repository evidence later requires a different route, stop and return to Revise.
