# Subgraph Stabilization Download Closure Plan

Execution: focused Gastown follow-up discovered during final in-app Chromium acceptance.

## Packages

- `ST-DR` — read-only isolate why click-time Blob href mutation emits no browser download and freeze the smallest robust lifecycle; Terra Medium.
- `ST-D` — implement robust real-anchor Blob downloads for all three artifacts with delayed cleanup and focused browser-like coverage; Terra High; depends on `ST-DR`.

## Frozen boundaries

- Preserve filenames, MIME types, generated content, scenario UI, freeze/unfreeze, and all accepted stabilization behavior.
- Use a real temporary `<a download>` with a Blob/ObjectURL inside the user gesture; revoke only after the browser has consumed the navigation.
- No global error suppression, data URI fallback, unrelated UI change, deployment, or graph mutation.
