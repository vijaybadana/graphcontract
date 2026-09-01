# GraphContract Agent Skill Foundation Lead Plan

Contract: `docs/epics/agent-skill-foundation/engineering_contract.md`

## Packages

1. `GS-F` — Freeze the public skill contract and machine-discovery shape.
2. `GS-I` — Author the canonical skill, lifecycle reference, OpenAI metadata, and integrity index.
3. `GS-V` — Add focused package/discovery/tool-authority tests and run the official validator.
4. `GS-C` — Run the full repository gates, inspect the production artifact, and close on a clean commit.

## Implementation decisions

- `public/.well-known/agent-skills/graphcontract/SKILL.md` is both the maintained source and the served canonical document.
- `public/.well-known/agent-skills/index.json` uses a standard `sha256-<base64>` SRI digest. A repository test recomputes it from the canonical source, so content drift fails CI.
- The package is self-contained except for one focused lifecycle reference loaded only when a concrete transition example is useful.
- Existing logo files are not copied into the skill package; omitting optional icon metadata keeps installation portable and avoids a duplicate asset.

## Regression controls

- Register the actual WebMCP adapter in a focused test and assert exactly `get_graph`, `propose_graph_changes`, and `get_branch_scenarios`.
- Do not modify application source or deployment configuration.
- Preserve the existing untracked `output/` directory.
