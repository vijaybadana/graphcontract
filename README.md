# GraphContract

GraphContract is a human-controlled visual workspace for designing agent workflows. People edit the graph directly, while external agents use WebMCP to inspect the accepted graph and propose structured changes that only a human can approve.

This repository is being built for [The WebMCP Challenge](https://webmcp.devpost.com/).

## Current status

The repository currently contains the hosting and WebMCP compatibility spike: a recognizable GraphContract workspace and a native, read-only `get_graph` WebMCP tool.

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
