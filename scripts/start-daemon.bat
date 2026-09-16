@echo off
REM Start MCP Daemon
REM Windows 启动脚本

echo Starting SiYuan MCP Daemon...

cd /d "%~dp0\..\mcp-daemon"

if not exist "dist\index.js" (
    echo Error: Daemon not built. Please run 'npm run build' first.
    pause
    exit /b 1
)

echo Daemon starting on port 3001...
echo MCP Server will be available on port 3000
echo.
echo Use Ctrl+C to stop the daemon
echo.

node dist\index.js

pause
