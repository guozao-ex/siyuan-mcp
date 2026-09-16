/**
 * HTTP Server for MCP
 * Provides HTTP endpoints for plugin integration
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { SiYuanClient } from '../siyuan/api.js';
import { TOOL_NAMES, TOOL_SCHEMAS, getToolDefinition, invokeTool } from '../tools/registry.js';
import { logger, getLogger } from '../core/logger.js';
import { createIpRateLimiter, IpRateLimiter } from '../core/rate-limiter.js';
import { registerMcpHttpRoutes } from './mcp-http.js';

export interface HttpServerConfig {
  port: number;
  host: string;
  cors?: boolean;
  /**
   * 共享密钥。设置后，除健康检查外的所有端点都要求
   * `Authorization: Bearer <token>`。
   * 为空表示不启用认证 —— 只允许在绑定回环地址时出现
   * （由 config.ts 的 validateConfig 强制）。
   */
  authToken?: string;
}

/** 常量时间字符串比较，避免通过响应耗时泄露 token 前缀 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export class HttpServer {
  private app: express.Application;
  private config: HttpServerConfig;
  private client: SiYuanClient;
  private rateLimiter: IpRateLimiter;

  constructor(client: SiYuanClient, config: HttpServerConfig) {
    this.client = client;
    this.config = config;
    this.app = express();

    // Initialize rate limiter
    //
    // 默认 60 请求/分钟（防滥用）。做成可配置的原因：自动化验收脚本会连续发
    // 几十上百次调用，硬编码 60 会让长测试跑到一半被 'Too many requests' 挡住 ——
    // 而那并不是被测功能有问题。
    const rateLimitMax = Number(process.env.MCP_RATE_LIMIT_MAX ?? 60);
    const rateLimitWindowMs = Number(process.env.MCP_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
    this.rateLimiter = createIpRateLimiter({
      windowMs:
        Number.isFinite(rateLimitWindowMs) && rateLimitWindowMs > 0
          ? rateLimitWindowMs
          : 60 * 1000,
      maxRequests: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 60,
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware() {
    // Enable CORS if configured
    if (this.config.cors) {
      this.app.use(
        cors({
          origin: '*',
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        })
      );
    }

    // Parse JSON bodies with UTF-8 encoding
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Authentication
    // 放在限流之前：未认证的请求不应该消耗限流配额。
    // 覆盖 /mcp 与全部 REST 端点（它们都能读写笔记）。
    if (this.config.authToken) {
      const expected = this.config.authToken;
      this.app.use((req, res, next) => {
        // 健康检查免认证，便于探活与进程管理
        if (req.method === 'GET' && req.path === '/health') {
          next();
          return;
        }

        const header = req.headers.authorization || '';
        const match = /^Bearer\s+(.+)$/i.exec(header);
        const provided = match ? match[1].trim() : '';

        if (!safeEqual(provided, expected)) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'A valid "Authorization: Bearer <token>" header is required.',
          });
          return;
        }

        next();
      });
    }

    // Rate limiting
    this.app.use((req, res, next) => {
      const identifier = req.ip || 'unknown';

      if (!this.rateLimiter.isAllowed(identifier)) {
        const resetTime = this.rateLimiter.getResetTime(identifier);
        res.status(429).json({
          error: 'Too many requests',
          resetAt: new Date(resetTime).toISOString(),
        });
        return;
      }

      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substring(7);

      const enhancedLogger = getLogger();
      enhancedLogger.logRequestStart(req.method, req.path, requestId);

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        enhancedLogger.logRequestEnd(req.method, req.path, res.statusCode, duration, requestId);
      });

      next();
    });
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // List available tools
    // 与 stdio 模式共用同一份注册表，保证两种传输暴露的工具集完全一致
    // （此前这里硬编码了 8 个名字，漏掉了 4 个 batch 工具）
    this.app.get('/tools', (req, res) => {
      res.json({ tools: TOOL_NAMES });
    });

    // 工具的完整定义（含 JSON Schema）。
    // 插件用它把 MCP 工具转成模型侧的 tools 参数。单独开一个端点而不是扩展现有
    // /tools，是为了不破坏后者「字符串数组」的既有契约。
    this.app.get('/api/tools', (req, res) => {
      res.json({ tools: TOOL_SCHEMAS });
    });

    // Call tool endpoint
    this.app.post('/tools/call', async (req, res) => {
      await this.handleToolCall(req, res);
    });

    // Individual tool endpoints
    this.app.post('/search', async (req, res) => {
      await this.handleToolCall(req, res, 'search_notes');
    });

    this.app.post('/notebooks', async (req, res) => {
      await this.handleToolCall(req, res, 'list_notebooks');
    });

    this.app.post('/read', async (req, res) => {
      await this.handleToolCall(req, res, 'read_block');
    });

    this.app.post('/document', async (req, res) => {
      await this.handleToolCall(req, res, 'read_document');
    });

    this.app.post('/create', async (req, res) => {
      await this.handleToolCall(req, res, 'create_document');
    });

    this.app.post('/update', async (req, res) => {
      await this.handleToolCall(req, res, 'update_block');
    });

    this.app.post('/append', async (req, res) => {
      await this.handleToolCall(req, res, 'append_block');
    });

    this.app.post('/delete', async (req, res) => {
      await this.handleToolCall(req, res, 'delete_block');
    });

    // ==================== Log Management Endpoints ====================

    // Get logs with optional filters
    this.app.get('/api/logs', async (req, res) => {
      try {
        const enhancedLogger = getLogger();
        const options = {
          level: req.query.level as any,
          limit: parseInt(req.query.limit as string) || 100,
          offset: parseInt(req.query.offset as string) || 0,
          search: req.query.search as string,
        };

        const logs = await enhancedLogger.queryLogs(options);
        res.json({ logs, count: logs.length });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get recent errors
    this.app.get('/api/logs/errors', async (req, res) => {
      try {
        const enhancedLogger = getLogger();
        const limit = parseInt(req.query.limit as string) || 50;
        const errors = await enhancedLogger.getRecentErrors(limit);
        res.json({ errors, count: errors.length });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get log statistics
    this.app.get('/api/logs/stats', async (req, res) => {
      try {
        const enhancedLogger = getLogger();
        const stats = await enhancedLogger.getLogStats();
        const apiMetrics = enhancedLogger.getApiMetrics();
        res.json({ ...stats, apiMetrics });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get client statistics (including circuit breaker state)
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = this.client.getStats();
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Reset circuit breaker
    this.app.post('/api/circuit-breaker/reset', async (req, res) => {
      try {
        this.client.resetCircuitBreaker();
        res.json({ success: true, message: 'Circuit breaker reset' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get server status
    this.app.get('/api/status', (req, res) => {
      const enhancedLogger = getLogger();
      res.json({
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        circuitBreakerState: this.client.getCircuitBreakerState(),
        logLevel: enhancedLogger.getLevel(),
        timestamp: Date.now()
      });
    });

    // ==================== Standard MCP (Streamable HTTP) ====================
    // 除自定义 REST 之外，再暴露一套**标准 MCP** 端点（POST/GET/DELETE /mcp），
    // 供 Claude Desktop / Cursor 等标准 MCP 客户端直连。
    // 必须注册在 404 兜底之前；工具集与 stdio 模式共用 registry。
    registerMcpHttpRoutes(this.app, this.client, {
      enableJsonResponse: process.env.MCP_HTTP_JSON_RESPONSE === '1',
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      logger.error('HTTP Server Error:', err);
      res.status(500).json({
        error: err.message || 'Internal server error',
      });
    });
  }

  /**
   * Handle tool call request
   */
  private async handleToolCall(
    req: Request,
    res: Response,
    toolName?: string
  ) {
    const startTime = Date.now();
    let success = false;

    try {
      const name = toolName || req.body.name;
      const args = toolName ? req.body : req.body.arguments || {};

      if (!name) {
        res.status(400).json({ error: 'Tool name is required' });
        return;
      }

      logger.info(`Calling tool: ${name}`, args);

      // 未知工具按 400 处理（在调用前判定，避免把参数错误混为一谈）
      if (!getToolDefinition(name)) {
        res.status(400).json({ error: `Unknown tool: ${name}` });
        return;
      }

      // 统一走注册表分派 —— 与 stdio 模式是同一套实现
      const result = await invokeTool(this.client, name, args);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json({
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      });

      success = true;

      // Log successful tool call
      const duration = Date.now() - startTime;
      const enhancedLogger = getLogger();
      enhancedLogger.info(`Tool call succeeded: ${name}`, { args, duration });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const enhancedLogger = getLogger();
      enhancedLogger.error('Tool call error:', errorMessage);

      // Log failed tool call
      const duration = Date.now() - startTime;
      const name = toolName || req.body.name || 'unknown';
      enhancedLogger.error(`Tool call failed: ${name}`, { args: req.body, duration, error: errorMessage });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(500).json({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      });
    }
  }

  /**
   * Start HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app.listen(this.config.port, this.config.host, () => {
          logger.info(
            `HTTP server listening on http://${this.config.host}:${this.config.port}`
          );
          resolve();
        });
      } catch (error) {
        logger.error('Failed to start HTTP server:', error);
        reject(error);
      }
    });
  }
}

/**
 * Create and start HTTP server
 */
export async function createHttpServer(
  client: SiYuanClient,
  config: HttpServerConfig
): Promise<HttpServer> {
  const server = new HttpServer(client, config);
  await server.start();
  return server;
}

