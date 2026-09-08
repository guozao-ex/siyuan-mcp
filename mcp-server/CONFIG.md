# MCP Server Configuration Guide

## Environment Variables

The MCP server can be configured using environment variables. Create a `.env` file in the `mcp-server` directory based on `.env.example`.

### SiYuan API Configuration

```bash
# SiYuan API base URL
SIYUAN_API_URL=http://127.0.0.1:6806

# SiYuan API Token (optional, required if authentication is enabled)
SIYUAN_API_TOKEN=your-token-here
```

**Getting API Token:**
1. Open SiYuan
2. Settings → About → API Token
3. Copy the token to `.env` file

### Transport Mode

```bash
# Transport mode: stdio or http
MCP_TRANSPORT=http
```

**stdio mode**: For Claude Desktop and CLI tools
**http mode**: For browser plugins and web applications

### HTTP Server Configuration

```bash
# HTTP server port (default: 3000)
MCP_PORT=3000

# HTTP server host (default: 127.0.0.1)
MCP_HOST=127.0.0.1
```

## Usage Examples

### stdio Mode (Claude Desktop)

1. Configure in Claude Desktop `config.json`:

```json
{
  "mcpServers": {
    "siyuan": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SIYUAN_API_URL": "http://127.0.0.1:6806",
        "SIYUAN_API_TOKEN": "your-token",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### HTTP Mode (Plugin)

1. Start HTTP server:

```bash
cd mcp-server
MCP_TRANSPORT=http npm start
```

2. Configure plugin settings:
   - MCP Server URL: `http://127.0.0.1:3000`

## Configuration Priority

Environment variables are loaded in this order (higher priority first):

1. System environment variables
2. `.env` file in `mcp-server` directory
3. Default values in code

## Security Recommendations

1. **Never commit `.env` file** to version control
2. **Use API Token** if SiYuan is exposed to network
3. **Bind HTTP server to localhost** (`127.0.0.1`) if only local access needed
4. **Use HTTPS** if exposing HTTP server to external network (requires reverse proxy)

## Troubleshooting

### Cannot connect to SiYuan

- Check if SiYuan is running
- Verify `SIYUAN_API_URL` is correct
- Check if API Token is required and valid

### HTTP server fails to start

- Check if port is already in use
- Try a different port: `MCP_PORT=3001`
- Check firewall settings

### Plugin cannot connect to MCP server

- Verify MCP server is running in HTTP mode
- Check plugin settings match server configuration
- Check browser console for CORS errors
