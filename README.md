# GraphContract

GraphContract is a human-controlled visual workspace for designing agent workflows. People edit the graph directly, while external agents use WebMCP to inspect the accepted graph and propose structured changes that only a human can approve.

This repository is being built for [The WebMCP Challenge](https://webmcp.devpost.com/).

## Current status

The repository contains a locally verified MVP with visual graph editing, validation, human-reviewed agent proposals, contract freezing, exhaustive scenario generation, and three downloadable artifacts. All three WebMCP tools are registered in the browser; production WebMCP discovery is the next verification gate.

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
npm run dev
```

Open `http://localhost:3000` in ChatGPT's in-app browser or a WebMCP-enabled Chrome build.

## Build

```bash
npm run build
```

## License

Released under the [MIT License](LICENSE).
