# GraphContract Agent Skill Foundation Result

## Outcome

- Added one canonical, portable `graphcontract` skill directly on the application's static publication surface.
- Encoded the human-governed `DISCOVER -> PLAN -> REVIEW -> REVISE/FREEZE -> HANDOFF` lifecycle while keeping Status read-only and outside the lifecycle.
- Named and constrained the actual three WebMCP tools: `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`.
- Added normal implicit discovery metadata and a compact travel-booking lifecycle reference.
- Added a minimal public discovery index pinned to the canonical `www.graphcontract.dev` URL with a test-enforced SHA-256 SRI digest.
- Preserved application semantics, canvas behavior, visual design, repository-library behavior, deployment configuration, and human-only approval/rejection/freeze authority.

## Verification

- Official `quick_validate.py`: skill is valid.
- Focused Vitest: 1 file, 3 tests passed.
- Full Vitest: 36 files, 257 tests passed.
- ESLint: passed.
- Production `vinext build`: passed.
- Production artifact inspection: all skill package files and the index are present under `dist/client/.well-known/agent-skills`; canonical source and index are byte-identical to the public inputs and the digest matches.
- `git diff --check`: passed.

## Publication boundary

This package does not deploy or mutate DNS. A later authorized deployment must publish this commit and route `www.graphcontract.dev` to the GraphContract application before the canonical discovery URL becomes publicly reachable. No application code or WebMCP registration changed in this package.
