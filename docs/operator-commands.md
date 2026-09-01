# GraphContract operator commands

This document is the executable command index for the current repository. The
repository manifest remains the source of truth for exact command names.

## Local runtime

All lifecycle commands accept `--run-id`; the canonical local identifier is
`graphcontract-local`. `local:run` and `local:reload` are idempotent.

| Action | Command |
| --- | --- |
| Prepare a production build | `npm run local:setup -- --run-id graphcontract-local` |
| Start or adopt the runtime | `npm run local:run -- --run-id graphcontract-local` |
| Read effective status | `npm run local:status -- --run-id graphcontract-local` |
| Apply source changes safely | `npm run local:reload -- --run-id graphcontract-local` |
| Force a clean managed restart | `npm run local:restart -- --run-id graphcontract-local` |
| Stop the owned runtime | `npm run local:stop -- --run-id graphcontract-local` |

The managed URL is `http://127.0.0.1:3000`. Every lifecycle action emits one
`portal-operator-result-v1` object. Unknown processes occupying the requested
port are reported but never terminated.

## Validation

Choose the smallest command that can expose the named regression. Do not run
both profiles when integration coverage already subsumes the relevant behavior.

| Scope | Command |
| --- | --- |
| One Vitest file or filter | `npm run test:unit -- <file-or-filter>` |
| Development profile: lint and unit/component tests | `npm run test:dev` |
| Browser integration/acceptance profile | `npm run test:integration` |
| Interactive browser diagnosis | `npm run test:e2e:headed` |
| Inspect the last Playwright report | `npm run test:e2e:report` |
| Production compilation only | `npm run build` |

`test:e2e` remains a backwards-compatible alias for `test:integration`.
Playwright owns an isolated IPv4 production runtime on `127.0.0.1:3217` by
default, so it does not interfere with the review runtime on port 3000.

## Intentionally unavailable commands

The following Company workflows do not have repository commands in the current
GraphContract build:

- `uat-control`: GraphContract has no vendor modes, kill switches, allowances,
  credits, calls-in-flight state, or other hot control plane.
- authenticated `uat:handoff`: the hackathon build has no accounts,
  authentication, protected workspace, or identity-isolated customer path.
  Local review uses the managed runtime plus the in-app browser handoff.
- `delivery:lifecycle` and `staging:prepare`: this repository does not own a
  Kestra qualification or staging transport implementation.
- provider debugging, vendor integration, and LangSmith tracing commands: no
  corresponding runtime provider or trace-ingestion capability is currently
  implemented.
- lead scheduling and task control: these are Company orchestration surfaces,
  not GraphContract repository commands.

Do not add placeholder commands that claim these capabilities. Add each surface
only with its real application state, authority boundary, structured result,
and focused contract coverage.
