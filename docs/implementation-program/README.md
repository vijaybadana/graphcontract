# GraphContract implementation program

This directory is the execution handover for implementing the complete evidence-backed visual language. It is intentionally separate from the currently active routing-semantics package.

Do not start this program until routing semantics has passed final owner review, is committed, and the working tree is clean.

## Read in order

1. [Lead handover](lead-handover.md)
2. [Build checklist](checklist.md)
3. [Design-system implementation contract](../design-system/implementation-contract.md)
4. [Design-system index and boards](../design-system/README.md)
5. [Routing contract](../epics/routing-semantics/design-contract.md)
6. [Current domain and WebMCP contracts](../contracts.md)

## Authority

- The written contracts are authoritative for semantics and behavior.
- The PNG boards are authoritative for hierarchy, visual grammar, density and interaction intent.
- When generated-image microcopy or numbering conflicts with a written contract, follow the written contract.
- The accepted graph remains canonical. React Flow, runtime views, evidence overlays and proposal previews remain projections.

## Delivery model

The program is split into commit-gated feature packages. Complete domain, migration, application/state, projection, inspector, WebMCP, persistence/export, automated tests and real-browser closure for one package before starting the next.
