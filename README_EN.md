# SiYuan MCP

A universal MCP server and plugin for SiYuan Note, supporting all AI agents with MCP protocol.

English | [简体中文](./README.md)

## Features

- 🔧 **72 MCP tools**: search, read, write, batch operations, navigation (backlinks / outline / tags / file tree), assets and system status
- 🛡️ **Risk grading**: every tool carries MCP-native `annotations` (read-only / destructive); destructive tools state in their description that the user must be asked first
- 🤖 **AI integration**: connect any MCP-capable agent (Claude Desktop / Cursor / DSH, …) — **no LLM API key required**
- 🔌 **Two transports**: stdio (local agents) and HTTP (custom REST plus the standard `POST /mcp`)
- ⚙️ **Lightweight plugin**: the SiYuan plugin only configures the MCP server; it does not duplicate AI features
- 🌍 **Internationalization**: plugin UI in Chinese and English
- ⚡ **Performance & reliability**: request caching, retries, circuit breaker, rate limiting

## Project Structure

```
.
├── mcp-server/          # MCP server (Node 18+ / TypeScript, HTTP mode defaults to port 3000)
│   ├── src/
│   │   ├── core/        # Infrastructure (config, logging, cache, retry, rate limit, index wait)
│   │   ├── server/      # Transports (custom REST + standard Streamable HTTP /mcp)
│   │   ├── siyuan/      # SiYuan API wrapper
│   │   ├── tools/       # MCP tool implementations and registry (destructive ones grouped)
│   │   └── index.ts
│   ├── tests/           # vitest tests
│   └── package.json
│
├── mcp-daemon/          # Process daemon: supervises the mcp-server process, HTTP control API on port 3001
│   ├── src/             # MCPDaemon + DaemonControlServer
│   └── package.json
│
├── siyuan-plugin/       # SiYuan plugin (Svelte 4 / Vite 5)
│   ├── src/
│   │   ├── components/  # Settings panel
│   │   ├── api/         # MCP server client
│   │   └── styles/      # Stylesheets
│   └── package.json
│
├── scripts/             # Verification & deployment tooling (protocol checks, tool acceptance, plugin deploy/package, daemon launchers)
│
└── docs/                # User docs (guides/ how-to, reference/ API reference)
```

`mcp-daemon/` is the **process daemon** for the MCP server: it starts / stops / restarts the `mcp-server`
child process, maintains the PID file and logs, and exposes an HTTP control API on port **3001**
(`POST /daemon/start`, `POST /daemon/stop`, `POST /daemon/restart`, `GET /daemon/status`, `GET /daemon/health`).
`scripts/start-daemon.bat` / `scripts/start-daemon.sh` are convenience launchers for it.
The MCP server itself listens on port **3000** in HTTP mode.

## Quick Start

### 1. MCP Server

#### Install Dependencies

```bash
cd mcp-server
npm install
```

#### Configuration

Copy `.env.example` to `.env` and configure:

```bash
SIYUAN_API_URL=http://127.0.0.1:6806
SIYUAN_API_TOKEN=your-token-here
MCP_TRANSPORT=http
MCP_PORT=3000
```

#### Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 2. SiYuan Plugin

#### Install Dependencies

```bash
cd siyuan-plugin
npm install
```

#### Development

```bash
npm run dev
```

Build output will be in `dist/` directory.

#### Install to SiYuan

**Method 1: Symbolic Link (Recommended for development)**

```bash
# Windows
mklink /D "C:\SiYuan\data\plugins\siyuan-plugin-mcp" "D:\DEV\siyuan\siyuan-plugin\dist"

# macOS/Linux
ln -s /path/to/siyuan/siyuan-plugin/dist ~/SiYuan/data/plugins/siyuan-plugin-mcp
```

**Method 2: Direct Copy**

Copy `dist/` directory to SiYuan's `data/plugins/` directory.

Then reload plugins in SiYuan.

## Usage

### Claude Desktop

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "siyuan": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SIYUAN_API_URL": "http://127.0.0.1:6806",
        "SIYUAN_API_TOKEN": "your-api-token",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### SiYuan Plugin

The plugin is a **configuration entry point only**: it ships no AI capabilities at all —
neither a chat UI nor block-level AI actions. Everything AI-related is delegated to
external agents (DSH / Claude Desktop / Cursor) over MCP.

Usage is a single step:

1. Click the topbar icon (or search "settings" in the command palette) to configure
   the MCP server URL and token
2. Connect that MCP server from your own AI client, then use it to read and write notes

> Why: a dedicated agent already covers chatting and writing assistance. Bundling a
> second copy inside the plugin adds maintenance surface and forces users to configure
> an extra LLM key. **The whole chain now needs no LLM API key at all** — MCP simply
> carries data between the agent and SiYuan.

## Development

### Running Tests

```bash
cd mcp-server
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Code Style

Code style is governed by two config files at the repository root:

- `.eslintrc.cjs` — ESLint (`eslint:recommended` + `@typescript-eslint/recommended`)
- `.prettierrc` — Prettier (`semi: true`, `singleQuote: true`, `tabWidth: 2`, `printWidth: 100`, ...)

**Note: no package wires up `lint` / `lint:fix` / `format` scripts yet, and neither eslint nor prettier
is listed as a dependency of any package, so `npm run lint` and `npm run format` are not available.**
Until those scripts exist, follow the two config files manually.

### Build

```bash
# MCP server
cd mcp-server
npm run build

# SiYuan plugin
cd siyuan-plugin
npm run build
```

## Documentation

- [Quick Start](./docs/guides/QUICKSTART.md)
- [Examples](./docs/guides/EXAMPLES.md)
- [Testing Guide](./docs/guides/TESTING_GUIDE.md)
- [API Reference](./docs/reference/API.md)
- [Configuration Guide](./mcp-server/CONFIG.md)
- [MCP Server Testing](./mcp-server/TESTING.md)

## Tech Stack

### MCP Server
- TypeScript 5.6+
- Node.js 18+
- @modelcontextprotocol/sdk
- Express (HTTP mode)

### SiYuan Plugin
- TypeScript 5.6+
- Svelte 4.2+
- Vite 5.4+
- SiYuan SDK

## FAQ

### Cannot Connect to SiYuan API

- Ensure SiYuan is running
- Check `SIYUAN_API_URL` configuration
- Verify `SIYUAN_API_TOKEN` if API authentication is enabled

### HTTP Server Won't Start

- Check if port is already in use
- Try different port: `MCP_PORT=3001`
- Check firewall settings

### Plugin Won't Load

- Verify plugin is installed in `data/plugins/` directory
- Check SiYuan console for errors
- Try restarting SiYuan

More issues: [GitHub Issues](https://github.com/guozao-ex/siyuan-mcp/issues)

## Contributing

Issues and Pull Requests are welcome!

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

MIT License - See [LICENSE](./LICENSE)

## Acknowledgments

- [SiYuan Note](https://github.com/siyuan-note/siyuan)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Anthropic Claude](https://www.anthropic.com/claude)

## Contact

- Homepage: https://github.com/guozao-ex/siyuan-mcp
- Issues: https://github.com/guozao-ex/siyuan-mcp/issues
