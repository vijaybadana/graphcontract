# GraphContract

GraphContract is a human-controlled visual workspace for designing agent workflows. People edit the graph directly, while external agents use WebMCP to inspect the accepted graph and propose structured changes that only a human can approve.

This repository is being built for [The WebMCP Challenge](https://webmcp.devpost.com/).

## Current status

The repository contains a locally verified MVP with visual graph editing, validation, human-reviewed agent proposals, contract freezing, bounded deterministic scenario generation, and three downloadable artifacts. All three WebMCP tools are registered in the browser; production WebMCP discovery is the next verification gate.

The public Sites URL currently hosts the earlier compatibility spike and may lag the latest `main` branch until the next verified deployment.

Public app: [graphcontract.vijaybadana.chatgpt.site](https://graphcontract.vijaybadana.chatgpt.site)

## Project documents

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Data and WebMCP contracts](docs/contracts.md)
- [Implementation checklist](docs/implementation-checklist.md)

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run local:run -- --run-id graphcontract-local
```

Open `http://127.0.0.1:3000` in ChatGPT's in-app browser or a WebMCP-enabled Chrome build.

`local:run` is the canonical local operator command. It binds explicitly to IPv4,
rebuilds stale output, reuses an already healthy owned runtime, and reports ready
only after the page and all referenced JavaScript and CSS assets pass health checks.

```bash
npm run local:status -- --run-id graphcontract-local
npm run local:restart -- --run-id graphcontract-local
npm run local:stop -- --run-id graphcontract-local
```

For low-level hot-reload development, `npm run dev -- --hostname 127.0.0.1` remains
available, but it is intentionally outside the managed lifecycle above.

## Build

```bash
npm run build
```

## License

Released under the [MIT License](LICENSE).

Third-party acknowledgements and retained license notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
