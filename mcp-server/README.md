# SiYuan MCP Server

MCP (Model Context Protocol) server for SiYuan Note.

## Features

- Search notes and blocks
- Read note content
- Create and update notes
- HTTP and stdio transport support

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "siyuan": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SIYUAN_API_URL": "http://127.0.0.1:6806",
        "SIYUAN_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Environment Variables

- `SIYUAN_API_URL`: SiYuan API base URL (default: `http://127.0.0.1:6806`)
- `SIYUAN_API_TOKEN`: SiYuan API authentication token
- `MCP_TRANSPORT`: Transport mode - `stdio` or `http` (default: `stdio`)
- `MCP_PORT`: HTTP server port when using http transport (default: `3000`)

## Directory Structure

```
src/
├── index.ts          # Main entry point
├── tools/            # MCP tool implementations
│   ├── search.ts     # Search tools
│   ├── read.ts       # Read tools
│   └── write.ts      # Write tools
├── siyuan/           # SiYuan API client
│   ├── api.ts        # API methods
│   └── types.ts      # Type definitions
└── utils/            # Utility functions
```
