/**
 * 标准 MCP Streamable HTTP 端点。
 *
 * 背景：本项目的 HTTP 模式原本只有一套**自定义 REST**（POST /tools/call 等），
 * 那是给自己家思源插件用的，并非 MCP 协议。结果是 README 宣称的
 * "支持所有 MCP 协议的 AI Agent" 只在 stdio 模式下成立。
 *
 * 本模块在同一个 Express app 上**额外**挂载标准 MCP 端点（POST/GET/DELETE /mcp），
 * 让 Claude Desktop、Cursor 等标准客户端可以通过 HTTP 直连；原有的 REST 端点保持不变。
 *
 * 工具定义来自 src/tools/registry.ts，因此 /mcp 与 stdio 暴露的工具集完全一致。
 *
 * 关于 session：按 MCP Streamable HTTP 规范，一次会话由 initialize 请求建立，
 * 服务端返回 mcp-session-id 响应头，后续请求需带上该头。
 * 一个 Server 实例只能连接一个 transport，因此这里为每个会话创建独立的 Server。
 */
import type { Application, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { SiYuanClient } from '../siyuan/api.js';
import { TOOL_SCHEMAS, invokeTool } from '../tools/registry.js';
import { getLogger } from '../core/logger.js';

export interface McpHttpOptions {
  /**
   * 为 true 时用普通 JSON 响应代替 SSE 流。
   * 默认 false（协议推荐 SSE），可用环境变量 MCP_HTTP_JSON_RESPONSE=1 打开。
   */
  enableJsonResponse?: boolean;
}

/** 为一个会话创建独立的 MCP Server（工具集与 stdio 共用注册表） */
function createMcpServer(client: SiYuanClient): Server {
  const server = new Server(
    { name: 'siyuan-mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_SCHEMAS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await invokeTool(client, name, (args as Record<string, any>) ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage, tool: name }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * 把标准 MCP 端点注册到给定的 Express app 上。
 * 注意：/mcp 只依赖 app 上已有的中间件（CORS / JSON 解析 / 认证 / 限流），
 * 因此必须在这批中间件注册**之后**调用。
 */
export function registerMcpHttpRoutes(
  app: Application,
  client: SiYuanClient,
  options: McpHttpOptions = {}
): void {
  const logger = getLogger();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const sendJsonRpcError = (res: Response, status: number, code: number, message: string) => {
    if (res.headersSent) return;
    res.status(status).json({
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    });
  };

  // ---- POST /mcp：initialize 与后续消息 ----
  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports.has(sessionId)) {
        // 已有会话
        transport = transports.get(sessionId)!;
      } else if (sessionId && !transports.has(sessionId)) {
        // 带了未知的 session id
        sendJsonRpcError(res, 404, -32001, `Session not found: ${sessionId}`);
        return;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // 新会话
        const created = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: options.enableJsonResponse,
          onsessioninitialized: (sid) => {
            transports.set(sid, created);
            logger.info(`MCP HTTP session initialized: ${sid}`);
          },
          onsessionclosed: (sid) => {
            transports.delete(sid);
            logger.info(`MCP HTTP session closed: ${sid}`);
          },
        });
        created.onclose = () => {
          const sid = created.sessionId;
          if (sid) transports.delete(sid);
        };
        created.onerror = (err) => {
          logger.error('MCP HTTP transport error:', err);
        };

        // 一个 Server 实例只能连一个 transport
        await createMcpServer(client).connect(created);
        transport = created;
      } else {
        sendJsonRpcError(
          res,
          400,
          -32000,
          'Bad Request: no valid session ID provided and the request is not an initialize request'
        );
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP HTTP POST /mcp failed:', error);
      sendJsonRpcError(res, 500, -32603, 'Internal error');
    }
  });

  // ---- GET /mcp（SSE 流）与 DELETE /mcp（终止会话）----
  const handleSessionRequest = async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        sendJsonRpcError(res, 400, -32000, 'Invalid or missing session ID');
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
    } catch (error) {
      logger.error('MCP HTTP session request failed:', error);
      sendJsonRpcError(res, 500, -32603, 'Internal error');
    }
  };

  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', handleSessionRequest);

  logger.info('Standard MCP Streamable HTTP endpoint mounted at POST/GET/DELETE /mcp');
}
