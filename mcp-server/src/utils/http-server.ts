/**
 * HTTP Server for MCP
 * Provides HTTP endpoints for plugin integration
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { SiYuanClient } from '../siyuan/api.js';
import { searchNotes, listNotebooks } from '../tools/search.js';
import { readBlock, readDocument } from '../tools/read.js';
import {
  createDocument,
  updateBlock,
  appendBlock,
  deleteBlock,
} from '../tools/write.js';
import { logger } from './logger.js';
import { createRateLimiter, RateLimiter } from './rate-limiter.js';

export interface HttpServerConfig {
  port: number;
  host: string;
  cors?: boolean;
}

export class HttpServer {
  private app: express.Application;
  private config: HttpServerConfig;
  private client: SiYuanClient;
  private rateLimiter: RateLimiter;

  constructor(client: SiYuanClient, config: HttpServerConfig) {
    this.client = client;
    this.config = config;
    this.app = express();

    // Initialize rate limiter (60 requests per minute)
    this.rateLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 60,
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

      logger.logRequest(req.method, req.path, req.body);

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.logResponse(req.method, req.path, duration, res.statusCode < 400);
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
    this.app.get('/tools', (req, res) => {
      res.json({
        tools: [
          'search_notes',
          'list_notebooks',
          'read_block',
          'read_document',
          'create_document',
          'update_block',
          'append_block',
          'delete_block',
        ],
      });
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

      let result: any;

      switch (name) {
        case 'search_notes':
          result = await searchNotes(this.client, args);
          break;

        case 'list_notebooks':
          result = await listNotebooks(this.client);
          break;

        case 'read_block':
          result = await readBlock(this.client, args);
          break;

        case 'read_document':
          result = await readDocument(this.client, args);
          break;

        case 'create_document':
          result = await createDocument(this.client, args);
          break;

        case 'update_block':
          result = await updateBlock(this.client, args);
          break;

        case 'append_block':
          result = await appendBlock(this.client, args);
          break;

        case 'delete_block':
          result = await deleteBlock(this.client, args);
          break;

        default:
          res.status(400).json({ error: `Unknown tool: ${name}` });
          return;
      }

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
      logger.logToolCall(name, args, duration, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Tool call error:', errorMessage);

      // Log failed tool call
      const duration = Date.now() - startTime;
      const name = toolName || req.body.name || 'unknown';
      logger.logToolCall(name, req.body, duration, false);

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
