# Netlify Deployment Lead Plan

Contract: `docs/epics/netlify-deployment/engineering_contract.md`
Candidate: `/Users/vijaybadana/graphcontract`, `main`, starting SHA `4839c80`
Strategy: keep the existing platform build unchanged, add one isolated Netlify/Nitro target, prove its artifact locally, publish an immutable commit, then configure Netlify and DNS only after the temporary Netlify URL passes smoke.

## Work packages

1. `ND-A` — Adapter boundary
   - Add the supported Nitro adapter only for Netlify builds.
   - Add repository-owned Netlify configuration and exact Node runtime selection.
   - Update production metadata to `graphcontract.dev`.
   - Preserve existing local and Sites/Cloudflare commands.

2. `ND-V` — Candidate verification
   - Run focused configuration checks and the exact Netlify production build.
   - Inspect generated output and locally smoke the built candidate where supported.
   - Run the established regression profile appropriate to the changed build boundary.
   - Commit only after tests, lint, build, and diff checks are green.

3. `ND-G` — Source publication
   - Push the exact clean `main` candidate to the existing public GitHub repository.
   - Confirm the remote branch resolves to the candidate SHA.

4. `ND-N` — Netlify transport
   - Import the GitHub repository into the existing Netlify account.
   - Use the repository-owned build settings; do not introduce dashboard-only drift.
   - Verify the generated `netlify.app` URL before custom-domain mutation.

5. `ND-D` — Domain and HTTPS
   - Add `graphcontract.dev` and `www.graphcontract.dev` to the Netlify project.
   - Record current Namecheap DNS, then apply only the records Netlify requires.
   - Verify DNS resolution, canonical redirect behavior, and managed HTTPS.

6. `ND-Q` — Live closure
   - Load the live production URL in Chromium.
   - Check title, canvas/library access, core authoring surface, downloads, and exactly three WebMCP tools with no unexpected console error.
   - Record the deployed SHA, Netlify URL, DNS outcome, rollback point, and any residual propagation risk.

## Gates

- No external mutation before `ND-A` and `ND-V` are green and committed.
- No custom-domain/DNS mutation before the temporary Netlify deploy passes smoke.
- If GitHub requests new repository permission, pause at the permission grant for explicit user confirmation.
- If DNS ownership/login requires user authentication or challenge completion, preserve the deployed Netlify URL and request only that bounded action.

## Architecture and regression controls

- Netlify selection is environment-driven; it must not load the Cloudflare adapter in the same build.
- Product state remains client-local for the hackathon release, so the deployment requires no backend or database.
- Build output, configuration, and deployment are derived from committed repository state, not untracked files or dashboard-only commands.
