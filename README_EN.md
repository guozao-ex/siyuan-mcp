# SiYuan MCP

A universal MCP server and plugin for SiYuan Note, supporting all AI agents with MCP protocol.

English | [简体中文](./README.md)

## Features

- 🔍 **Note Search**: Full-text search and block search
- 📖 **Note Reading**: Read note content
- ✍️ **Note Writing**: Create and modify notes
- 🤖 **AI Integration**: Connect various AI agents via MCP protocol
- 🎨 **Plugin UI**: User-friendly interface
- 🌍 **Internationalization**: Chinese and English support
- ⚡ **Performance**: Request caching and rate limiting

## Project Structure

```
.
├── mcp-server/          # MCP server (Node 18+ / TypeScript, HTTP mode defaults to port 3000)
│   ├── src/
│   │   ├── tools/       # MCP tool implementations
│   │   ├── siyuan/      # SiYuan API wrapper
│   │   └── utils/       # Utilities
│   ├── tests/           # vitest tests
│   └── package.json
│
├── mcp-daemon/          # Process daemon: supervises the mcp-server process, HTTP control API on port 3001
│   ├── src/             # MCPDaemon + DaemonControlServer
│   └── package.json
│
├── siyuan-plugin/       # SiYuan plugin (Svelte 4 / Vite 5)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── api/         # API calls
│   │   └── styles/      # Stylesheets
│   └── package.json
│
├── scripts/             # Startup scripts
│   ├── start-daemon.bat # Windows
│   └── start-daemon.sh  # macOS / Linux
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

## Development Status

Current version: v0.1.0

- ✅ **Phase 1 — Project initialization & infrastructure**: done; both `mcp-server/` and `mcp-daemon/` have build output (`dist/`)
- ✅ **Phase 2 — MCP server core**: done — `cd mcp-server && npx vitest run` reports **81 passed / 0 failed / 22 skipped**; stdio and HTTP share a single tool registry (**72 tools**, each verified by real invocation), and the HTTP side also exposes a standard MCP `POST /mcp` endpoint plus token auth
- ✅ **Phase 3 — Plugin**: done — the build chain now works (it had never been built successfully before); the plugin was verified inside SiYuan for loading, a settings read/write round-trip and topbar icon rendering
- ✅ **Phase 4 — Integration & optimization**: done — the daemon `mcp-daemon/` (control port 3001, including an installer), request retry / circuit breaker / rate limiting, enhanced logging and automatic `.env` loading. **The AI chat panel and the model-calling layer (`/api/chat`) were removed by decision**: the project's role is "MCP as the bridge between agents and SiYuan", so the whole chain **requires no LLM API key**
- 🔄 **Phase 5 — Testing & documentation**: in progress
- ⏳ **Phase 6 — Release preparation**: not started

> This section was verified against the actual code and command output on 2026-09-16 and deliberately does **not** repeat the
> "100% complete / all tests passing" claims found in the historical reports. The repository was being actively fixed while this
> check was made, so the values above are snapshots and individual items may already have changed — re-run the commands for the
> current state.

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
