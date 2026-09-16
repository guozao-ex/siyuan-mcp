#!/usr/bin/env node

/**
 * SiYuan MCP Server
 *
 * Provides MCP (Model Context Protocol) tools for interacting with SiYuan Note.
 *
 * 工具定义已抽取到 src/tools/registry.ts 作为**唯一数据源**：
 * stdio 与 http 两种传输模式共用同一份定义，避免再次出现工具集不同步
 * （此前 GET /tools 与 handleToolCall 都少了 4 个 batch 工具）。
 */

// ⚠️ 必须是第一条 import：该模块在被求值时就加载 .env（副作用模块）。
// 若放在后面，enhanced-logger / config 等模块会先在模块求值阶段读走 process.env，
// 导致 .env 里的 LOG_LEVEL、MCP_AUTH_TOKEN、LLM_API_KEY 等失效。
import './core/env-file.js';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createClient, SiYuanClient } from './siyuan/api.js';
import { TOOL_SCHEMAS, invokeTool } from './tools/registry.js';
import { createHttpServer } from './server/http.js';
import { loadConfig, validateConfig, printConfig } from './core/config.js';
import { createLogger } from './core/logger.js';

// Initialize logger
const logger = createLogger({
  logDir: process.env.LOG_DIR || './logs',
  level: (process.env.LOG_LEVEL as any) || 'info',
  console: process.env.NODE_ENV !== 'production'
});

logger.info('Starting SiYuan MCP Server...');

// Load and validate configuration
const config = loadConfig();
const configErrors = validateConfig(config);

if (configErrors.length > 0) {
  logger.error('Configuration errors detected', { errors: configErrors });
  configErrors.forEach((error) => logger.error(`  - ${error}`));
  process.exit(1);
}

// Print configuration summary
printConfig(config);
logger.info('Configuration loaded successfully');

// Get transport mode from configuration
const TRANSPORT_MODE = config.transportMode;
const HTTP_PORT = config.httpPort;
const HTTP_HOST = config.httpHost;

// Initialize SiYuan client
const siyuanClient: SiYuanClient = createClient(
  config.siyuanApiUrl,
  config.siyuanApiToken
);

// Create MCP server
const server = new Server(
  {
    name: 'siyuan-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ==================== Request Handlers ====================

// List available tools —— 直接来自注册表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_SCHEMAS };
});

// Handle tool calls —— 统一分派到注册表
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await invokeTool(siyuanClient, name, (args as Record<string, any>) ?? {});

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: errorMessage,
              tool: name,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ==================== Server Startup ====================

async function main() {
  // Check connection to SiYuan
  logger.info('Checking connection to SiYuan...');
  const status = await siyuanClient.getConnectionStatus();

  if (!status.connected) {
    logger.error('Failed to connect to SiYuan:', status.error);
    logger.error('Please ensure:');
    logger.error('1. SiYuan is running');
    logger.error('2. SIYUAN_API_URL is set correctly (default: http://127.0.0.1:6806)');
    logger.error('3. SIYUAN_API_TOKEN is set if required');
    process.exit(1);
  }

  logger.info(`Connected to SiYuan version ${status.version}`);
  logger.info(`Starting MCP server in ${TRANSPORT_MODE} mode...`);

  if (TRANSPORT_MODE === 'http') {
    // Start HTTP server
    await createHttpServer(siyuanClient, {
      port: HTTP_PORT,
      host: HTTP_HOST,
      cors: config.enableCors,
      authToken: config.authToken,
    });
    logger.info(`SiYuan MCP server running on http://${HTTP_HOST}:${HTTP_PORT}`);
  } else {
    // Start stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('SiYuan MCP server running on stdio');
  }
}

// Start server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
