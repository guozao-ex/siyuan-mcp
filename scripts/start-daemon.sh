#!/bin/bash
# Start MCP Daemon
# Linux/Mac 启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_DIR="$SCRIPT_DIR/../mcp-daemon"

echo "Starting SiYuan MCP Daemon..."

cd "$DAEMON_DIR"

if [ ! -f "dist/index.js" ]; then
    echo "Error: Daemon not built. Please run 'npm run build' first."
    exit 1
fi

echo "Daemon starting on port 3001..."
echo "MCP Server will be available on port 3000"
echo ""
echo "Use Ctrl+C to stop the daemon"
echo ""

node dist/index.js
