# Netlify Deployment Engineering Contract

Source: owner deployment request, 2026-09-01
Lead Executor: Backend Engineer
Candidate: GraphContract `main`
Target: Netlify production at `https://graphcontract.dev`

## Accepted outcome

GraphContract is deployed from its public GitHub repository to a Git-connected Netlify site, served over HTTPS at `graphcontract.dev` (with `www.graphcontract.dev` redirected or aliased consistently), while retaining the existing local/Sites build path and all browser-only product behavior.

## Customer scenarios

- ND-1: A visitor opens `https://graphcontract.dev` without the developer machine running and receives the production application over HTTPS.
- ND-2: The deployed canvas loads its built-in graph library and preserves editing, proposals, freeze/unfreeze, scenarios, and browser downloads.
- ND-3: A browser-capable external agent sees exactly the existing three WebMCP tools; no deployment change adds authority or tools.
- ND-4: A future push to the connected GitHub branch produces a new Netlify deploy using a reproducible repository-owned build.
- ND-5: Existing `npm run dev`, local runtime commands, and the Sites/Cloudflare build remain available.

## Change envelope

- Add an explicit Netlify/Nitro build target without replacing the existing Vinext + Sites/Cloudflare target.
- Record the required Node version and repository-owned Netlify build configuration.
- Update canonical production metadata to `graphcontract.dev`.
- Publish the exact committed candidate to GitHub, connect it to Netlify, add the custom domain, configure DNS, and verify HTTPS and the live browser surface.

## Protected contracts

- No Supabase, authentication, database, server-side user storage, or new product functionality.
- No replacement of React Flow, Vinext, WebMCP schemas, localStorage persistence, or export behavior.
- Exactly three WebMCP tools remain registered; proposal approval/rejection and freeze remain human-only.
- No secrets or provider credentials are committed.
- The existing untracked `output/` directory is preserved.

## Rollback

- Source rollback: revert the Netlify adapter/config commit; the previous Sites/Cloudflare build remains intact.
- Transport rollback: Netlify can restore the preceding successful deploy or detach the custom domain.
- DNS rollback: restore the previous Namecheap records recorded before mutation.

## Acceptance placement

Production browser at `https://graphcontract.dev`, owner: Vijay after technical smoke and live handoff.
