# GraphContract Agent Skill Foundation Contract

## Outcome

Publish one portable GraphContract skill package from the existing static surface so browser-capable coding agents can follow the product's human-governed planning lifecycle without expanding the application's authority or tool surface.

## Frozen lifecycle

`DISCOVER -> PLAN -> REVIEW`

- Human request changes: `REVISE -> REVIEW`
- Human rejection: `STOP`
- Human approval: `FREEZE -> HANDOFF`

`STATUS` is an optional read-only utility, not a lifecycle stage. Agents own Discover, Plan, Revise, and Handoff. Humans exclusively own review outcomes and freeze.

## Deliverables

- One canonical `graphcontract/SKILL.md` with concise authority and lifecycle instructions.
- OpenAI skill metadata in `agents/openai.yaml` with normal implicit discovery.
- One focused lifecycle reference containing the state transition and a compact travel-booking example.
- Static machine discovery at `/.well-known/agent-skills/index.json` with a test-enforced integrity digest.
- Focused validation for packaging, discovery integrity, and the unchanged exactly-three WebMCP surface.

## Boundaries

- No graph/domain, canvas, repository-library, visual-design, DNS, domain, or deployment changes.
- No new WebMCP tools, commands, scripts, broad agent manifests, or speculative integrations.
- No claim that GraphContract reads or parses a repository; the coding agent uses its own repository access.
- No agent approval, rejection, human response, resume, freeze, or unfreeze authority.
- No automatic skill installation, download, or remote script execution.

## Acceptance

- The official skill validator passes.
- Focused tests prove frontmatter and UI metadata, canonical discovery URL and digest, and exactly three registered WebMCP tools.
- Full tests, lint, production build, and `git diff --check` pass.
- The build contains the canonical skill package and discovery index at their public paths.
- The working tree is clean apart from the pre-existing untracked `output/` directory.
