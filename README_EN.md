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

1. Click AI icon in topbar to open chat panel
2. Right-click on blocks for AI operations:
   - Summarize content
   - Continue writing
   - Improve text
3. Configure MCP server URL in settings

## Documentation

- [Development Guide](./DEVELOPMENT.md)
- [Configuration Guide](./mcp-server/CONFIG.md)
- [Testing Guide](./mcp-server/TESTING.md)
- [Project Plan](./PROJECT_PLAN.md)

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

- ✅ Phase 1: Project initialization
- ✅ Phase 2: MCP server core
- ✅ Phase 3: Plugin UI
- ✅ Phase 4: Integration & optimization
- 🔄 Phase 5: Testing & documentation
- ⏳ Phase 6: Release preparation

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for details.

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
