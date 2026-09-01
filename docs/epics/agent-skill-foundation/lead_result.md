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

This work does not deploy or mutate DNS. A later authorized deployment must publish the relevant commits and route `www.graphcontract.dev` to the GraphContract application before the canonical discovery URL becomes publicly reachable. The foundation commit did not change application code or WebMCP registration; the local closure below adds the human review lifecycle while preserving the same three registered tools.

## Local closure — human revision requests and publication headers

- Added a third human-only `Request changes` review action alongside Approve and Reject. Its accessible dialog requires meaningful plain-text feedback, supports Escape/cancel, restores focus, and never mutates the accepted graph.
- Persisted one compact outstanding review request with proposal and accepted-graph identity. `get_graph` reports it separately as `untrusted-human-authored`; stale and invalid proposals retain it, while only a valid replacement accepted as pending consumes it.
- Kept rejection feedback-free, approval behavior unchanged, and the WebMCP surface at exactly three tools.
- Updated the published skill's REVIEW/REVISE instructions and regenerated its index digest.
- Scoped public CORS and explicit UTF-8 content types in `netlify.toml` to the skill Markdown and discovery index only. Local Vinext serving does not apply Netlify response headers, so header behavior is verified through the Netlify configuration contract and must be read back from a Netlify deploy when deployment is separately authorized.

### Closure verification

- Focused Vitest: 6 files, 89 tests passed.
- Full Vitest: 36 files, 265 tests passed.
- Focused cold Chromium journey: passed.
- Full cold Chromium: 89 tests passed with the repository console/page-error guard active.
- ESLint: passed with zero warnings.
- Netlify production preset build: passed; skill artifacts are present under `dist/client/.well-known/agent-skills`.
- Skill index SHA-256 digest: matches the published `SKILL.md` bytes.
- `git diff --check`: passed.
