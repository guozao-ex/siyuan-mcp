/**
 * SiYuan API Client
 */

import type {
  BaseResponse,
  ListNotebooksResponse,
  SearchBlocksRequest,
  SearchBlocksResponse,
  GetBlockKramdownRequest,
  GetBlockKramdownResponse,
  GetBlockAttrsRequest,
  GetBlockAttrsResponse,
  InsertBlockRequest,
  InsertBlockResponse,
  UpdateBlockRequest,
  UpdateBlockResponse,
  DeleteBlockRequest,
  DeleteBlockResponse,
  CreateDocWithMdRequest,
  CreateDocWithMdResponse,
  GetDocInfoRequest,
  GetDocInfoResponse,
  RenameDocRequest,
  RenameDocResponse,
  RemoveDocRequest,
  RemoveDocResponse,
  SqlQueryRequest,
  SqlQueryResponse,
  VersionResponse,
  BootProgressResponse,
  SiYuanApiError,
  UploadAssetRequest,
  UploadAssetResponse,
  ExportMdContentResponse,
  ImportStdMdRequest,
  ImportStdMdResponse,
  CreateNotebookRequest,
  CreateNotebookResponse,
  MoveDocsRequest,
  MoveDocsResponse,
  ListDocsByPathResponse,
  GetHPathByIDResponse,
  GetBacklinkRequest,
  GetBacklinkResponse,
  GetChildBlocksResponse,
  GetDocOutlineResponse,
  GetTagsResponse,
  Block,
  InsertLocalAssetsRequest,
  ResolveAssetPathRequest,
  ResolveAssetPathResponse,
  RenderTemplateRequest,
  RenderTemplateResponse,
  ExportHTMLRequest,
  ExportHTMLResponse,
  BatchExportMdRequest,
  ImportDataRequest,
  ImportNotebookRequest,
  SearchDocsRequest,
  SearchDocsResponse,
  GetBacklink2Request,
  GetBackmentionRequest,
  GetDocHistoryRequest,
  GetDocHistoryResponse,
  RollbackDocHistoryRequest,
  CreateSnapshotRequest,
  CreateSnapshotResponse,
  RollbackSnapshotRequest,
  GetBookmarkResponse,
  GetUnusedAssetsResponse,
  RemoveUnusedAssetsRequest,
  RenderSprigRequest,
  RenderSprigResponse,
  ExportPDFRequest,
  ExportDocxRequest,
  ImportSYRequest,
  GetHPathByPathRequest,
  GetHPathByPathResponse,
  GetNotebookHistoryRequest,
  GetNotebookHistoryResponse,
  RemoveSnapshotRequest,
  PerformSyncRequest,
  GetSyncStatusResponse,
  CreateCloudSnapshotRequest,
  GetShorthandResponse,
  PushMsgRequest,
  GetRiffDueCardsResponse,
  GetBlockBreadcrumbRequest,
  GetBlockBreadcrumbResponse,
  TransferBlockRefRequest,
  GetDocResponse,
  GetConfResponse,
  ExportResourcesResponse,
  GetTagResponse,
  ListTemplatesResponse,
  GetFileTreeResponse,
  GetAllReferencesResponse,
} from './types.js';
import { createCache, Cache } from '../core/cache.js';
import {
  RetryHandler,
  CircuitBreaker,
  RequestStats,
  ConcurrencyLimiter,
  CircuitState
} from '../core/retry.js';
import { getLogger } from '../core/logger.js';

/**
 * 思源 API 请求错误。
 *
 * 设计意图：`message` 始终是**底层原因**（例如 "Connection failed"），
 * 便于调用方做模式匹配与面向用户的展示；端点、请求 ID、熔断状态等
 * 诊断信息通过结构化字段携带，需要时再读，不污染 message。
 *
 * 背景：旧实现把 `endpoint / circuit breaker state / request id` 拼进 message，
 * 结果是调用方（以及 HTTP / MCP 客户端）拿到 4 行文本，
 * getConnectionStatus() 返回的 error 字段也因此失真。
 */
export class SiYuanRequestError extends Error {
  readonly endpoint: string;
  readonly requestId: string;
  readonly circuitBreakerState: CircuitState;
  readonly latency: number;

  constructor(
    message: string,
    details: {
      endpoint: string;
      requestId: string;
      circuitBreakerState: CircuitState;
      latency: number;
      cause?: unknown;
    }
  ) {
    super(message, { cause: details.cause });
    this.name = 'SiYuanRequestError';
    this.endpoint = details.endpoint;
    this.requestId = details.requestId;
    this.circuitBreakerState = details.circuitBreakerState;
    this.latency = details.latency;
  }
}

/**
 * 沿 cause 链取最底层错误的消息，用于向用户展示**根因**。
 * 例：重试包装后的 "Request failed after 4 attempts: X" -> "X"
 */
function rootCauseMessage(error: unknown): string {
  let current: any = error;
  let depth = 0;
  while (current && current.cause && depth < 10) {
    current = current.cause;
    depth += 1;
  }
  return current instanceof Error ? current.message : String(current);
}

export class SiYuanClient {
  private baseUrl: string;
  private token: string;
  private cache: Cache;
  private retryHandler: RetryHandler;
  private circuitBreaker: CircuitBreaker;
  private stats: RequestStats;
  private rateLimiter: ConcurrencyLimiter;
  private logger = getLogger();

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl || process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';
    this.token = token || process.env.SIYUAN_API_TOKEN || '';

    // Remove trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }

    // Initialize cache
    this.cache = createCache({
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
    });

    // Initialize retry handler
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      timeout: 10000,
      retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'fetch failed', 'network']
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,    // 5次失败后熔断
      successThreshold: 2,    // 2次成功后恢复
      timeout: 60000          // 熔断1分钟
    });

    // Initialize stats
    this.stats = new RequestStats();

    // Initialize rate limiter
    this.rateLimiter = new ConcurrencyLimiter({
      maxConcurrent: 10,      // 最多10个并发
      minTime: 50,            // 每个请求最少间隔50ms
      reservoir: 100,         // 初始容量
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 1000 // 每秒恢复
    });
  }

  /**
   * Generic request method with retry and circuit breaker
   */
  private async request<T>(endpoint: string, data?: any): Promise<T> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    // 记录请求开始
    this.logger.debug(`API Request Start: ${endpoint}`, { requestId, data });

    try {
      // 通过速率限制器执行
      const result = await this.rateLimiter.schedule(async () => {
        // 通过熔断器执行
        return await this.circuitBreaker.execute(async () => {
          // 通过重试处理器执行
          return await this.retryHandler.executeWithRetry(async () => {
            return await this.executeRequest<T>(endpoint, data);
          });
        });
      });

      // 记录成功
      const latency = Date.now() - startTime;
      this.logger.logApiCall(endpoint, latency, true);

      return result;
    } catch (error: any) {
      const latency = Date.now() - startTime;

      // 记录错误
      this.stats.recordError(endpoint, error);
      this.logger.logApiCall(endpoint, latency, false, error.message);
      this.logger.error(`API request failed: ${endpoint}`, {
        requestId,
        error: error.message,
        stack: error.stack,
        circuitBreakerState: this.circuitBreaker.getState(),
        duration: latency
      });

      // 保持 message 为底层原因，诊断上下文改为结构化携带。
      // 这样调用方（含 HTTP / MCP 客户端）拿到的仍是可读的根因，
      // 需要排查时再读 endpoint / requestId / circuitBreakerState 字段。
      throw new SiYuanRequestError(error.message, {
        endpoint,
        requestId,
        circuitBreakerState: this.circuitBreaker.getState(),
        latency,
        cause: error,
      });
    } finally {
      const latency = Date.now() - startTime;
      this.stats.recordRequest(latency);
    }
  }

  /**
   * Execute actual HTTP request
   */
  private async executeRequest<T>(endpoint: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data || {}),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 先取原始文本再解析。
    // 原因：思源个别接口在「无结果」时会返回**空 body**（实测 /api/ref/getBackmention
    // 与 /api/ref/getAllReferences 都是这样），直接 response.json() 会抛
    // "Unexpected end of JSON input"。空响应不是错误，按"无数据"处理。
    const raw = await response.text();
    if (!raw || !raw.trim()) {
      return null as unknown as T;
    }

    let result: BaseResponse<T>;
    try {
      result = JSON.parse(raw) as BaseResponse<T>;
    } catch {
      throw new Error(
        `SiYuan API returned a non-JSON response for ${endpoint}: ${raw.slice(0, 120)}`
      );
    }

    if (result.code !== 0) {
      const error = new Error(result.msg) as SiYuanApiError;
      error.name = 'SiYuanApiError';
      error.code = result.code;
      error.details = result.data;
      throw error;
    }

    return result.data;
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      ...this.stats.getStats(),
      circuitBreaker: this.circuitBreaker.getStats(),
      rateLimiter: this.rateLimiter.getStats(),
      cache: this.cache.stats()
    };
  }

  /**
   * Reset circuit breaker (for recovery)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  // ==================== System APIs ====================

  /**
   * Get SiYuan version
   */
  async getVersion(): Promise<string> {
    const data = await this.request<VersionResponse>('/api/system/version');
    return data.version;
  }

  /**
   * Get boot progress
   */
  async getBootProgress(): Promise<BootProgressResponse> {
    return this.request<BootProgressResponse>('/api/system/bootProgress');
  }

  // ==================== Notebook APIs ====================

  /**
   * List all notebooks with caching
   */
  async listNotebooks(): Promise<ListNotebooksResponse> {
    const cacheKey = 'notebooks:list';
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.request<ListNotebooksResponse>('/api/notebook/lsNotebooks');

    // Cache for 1 minute (notebooks don't change often)
    this.cache.set(cacheKey, result, 60 * 1000);
    return result;
  }

  // ==================== Search APIs ====================

  /**
   * Search blocks using SQL (more reliable than search API)
   */
  async searchBlocks(request: SearchBlocksRequest): Promise<SearchBlocksResponse> {
    // Use SQL query as a fallback since the search API returns empty
    const { query, boxes, page = 1, pageSize = 20 } = request;

    // Escape single quotes in query to prevent SQL injection
    const safeQuery = query.replace(/'/g, "''");

    let sqlWhere = `content LIKE '%${safeQuery}%'`;

    if (boxes && boxes.length > 0) {
      const boxFilter = boxes.map(b => `'${b.replace(/'/g, "''")}'`).join(',');
      sqlWhere += ` AND box IN (${boxFilter})`;
    }

    const offset = (page - 1) * pageSize;
    const stmt = `SELECT * FROM blocks WHERE ${sqlWhere} ORDER BY updated DESC LIMIT ${pageSize} OFFSET ${offset}`;

    const blocks = await this.sql(stmt);

    // Get total count
    const countStmt = `SELECT COUNT(*) as count FROM blocks WHERE ${sqlWhere}`;
    const countResult = await this.sql(countStmt);
    const total = (countResult[0] as any)?.count || blocks.length;

    return {
      blocks: blocks as any[],
      matchedBlockCount: total,
      matchedRootCount: blocks.filter((b: any, i: number, arr: any[]) =>
        arr.findIndex(x => x.root_id === b.root_id) === i
      ).length,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  /**
   * Full-text search with simple query string
   */
  async searchByKeyword(
    query: string,
    options?: {
      boxes?: string[];
      paths?: string[];
      page?: number;
      pageSize?: number;
    }
  ): Promise<SearchBlocksResponse> {
    return this.searchBlocks({
      query,
      method: 0, // keyword search
      boxes: options?.boxes,
      paths: options?.paths,
      page: options?.page || 1,
      pageSize: options?.pageSize || 20,
    });
  }

  // ==================== Block APIs ====================

  /**
   * Get block kramdown (markdown) content with caching
   */
  async getBlockKramdown(id: string): Promise<GetBlockKramdownResponse> {
    const cacheKey = `block:kramdown:${id}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.request<GetBlockKramdownResponse>(
      '/api/block/getBlockKramdown',
      { id }
    );

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get block attributes
   */
  async getBlockAttrs(id: string): Promise<GetBlockAttrsResponse> {
    return this.request<GetBlockAttrsResponse>('/api/attr/getBlockAttrs', { id });
  }

  /**
   * Insert a new block
   *
   * 注意返回的是**数组**（思源把 data 包了一层），新块 ID 在
   * `result[0].doOperations[0].id`。
   */
  async insertBlock(request: InsertBlockRequest): Promise<InsertBlockResponse[]> {
    return this.request<InsertBlockResponse[]>('/api/block/insertBlock', request);
  }

  /**
   * Update an existing block (invalidates cache)
   */
  async updateBlock(request: UpdateBlockRequest): Promise<UpdateBlockResponse> {
    const result = await this.request<UpdateBlockResponse>(
      '/api/block/updateBlock',
      request
    );

    // Invalidate cache for this block
    this.cache.delete(`block:kramdown:${request.id}`);

    return result;
  }

  /**
   * Delete a block
   */
  async deleteBlock(id: string): Promise<DeleteBlockResponse> {
    return this.request<DeleteBlockResponse>('/api/block/deleteBlock', { id });
  }

  /**
   * Append block to parent
   * 返回数组：新块 ID 在 `result[0].doOperations[0].id`
   */
  async appendBlock(
    parentID: string,
    markdown: string
  ): Promise<InsertBlockResponse[]> {
    return this.insertBlock({
      dataType: 'markdown',
      data: markdown,
      parentID,
    });
  }

  /**
   * Prepend block to parent
   * 返回数组：新块 ID 在 `result[0].doOperations[0].id`
   */
  async prependBlock(
    parentID: string,
    markdown: string
  ): Promise<InsertBlockResponse[]> {
    const children = await this.getDocChildBlocks(parentID);
    const firstChildID = children[0]?.id;

    return this.insertBlock({
      dataType: 'markdown',
      data: markdown,
      parentID,
      nextID: firstChildID,
    });
  }

  // ==================== Document APIs ====================

  /**
   * Create document with markdown content
   * @returns Document ID as a string
   */
  async createDocWithMd(
    notebook: string,
    path: string,
    markdown: string
  ): Promise<string> {
    return this.request<string>('/api/filetree/createDocWithMd', {
      notebook,
      path,
      markdown,
    });
  }

  /**
   * Get document info
   */
  async getDocInfo(id: string): Promise<GetDocInfoResponse> {
    return this.request<GetDocInfoResponse>('/api/block/getDocInfo', { id });
  }

  /**
   * Rename document
   *
   * 注意：思源这个接口返回 `data: null`，所以返回类型是 void ——
   * 不要试图读取响应内容（曾经因此抛 "Cannot read properties of null"）。
   */
  async renameDoc(notebook: string, path: string, title: string): Promise<void> {
    await this.request<void>('/api/filetree/renameDoc', {
      notebook,
      path,
      title,
    });
  }

  /**
   * Remove document
   *
   * 同 renameDoc：返回 `data: null`。
   */
  async removeDoc(notebook: string, path: string): Promise<void> {
    await this.request<void>('/api/filetree/removeDoc', {
      notebook,
      path,
    });
  }

  /**
   * Get child blocks of a document
   */
  async getDocChildBlocks(id: string): Promise<any[]> {
    const result = await this.sql(`SELECT * FROM blocks WHERE parent_id = '${id}' ORDER BY sort`);
    return result || [];
  }

  // ==================== SQL APIs ====================

  /**
   * Execute SQL query
   */
  async sql(stmt: string): Promise<Array<{ [key: string]: any }>> {
    const response = await this.request<Array<{ [key: string]: any }>>('/api/query/sql', { stmt });
    return response;
  }

  // ==================== Helper Methods ====================

  /**
   * Check if SiYuan is running and accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.getVersion();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection status with details
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const version = await this.getVersion();
      return { connected: true, version };
    } catch (error) {
      // 展示根因：经过重试包装后 message 会是
      // "Request failed after N attempts: <原因>"，这里沿 cause 链取到底层原因，
      // 让调用方（与最终用户）看到的是 "Connection failed" 而不是一长串包装文本。
      return {
        connected: false,
        error: rootCauseMessage(error),
      };
    }
  }

  // ==================== Asset APIs ====================

  /**
   * Upload asset files
   *
   * ⚠️ 思源的 `/api/asset/upload` 要求 **multipart/form-data**，不能走通用的
   * request()（后者固定发 JSON，实测会返回
   * "request Content-Type isn't multipart/form-data"）。这里单独实现，
   * 复用同一套 baseUrl 与 token。
   */
  async uploadAsset(request: UploadAssetRequest): Promise<UploadAssetResponse> {
    const url = `${this.baseUrl}/api/asset/upload`;

    const form = new FormData();
    form.append('assetsDirPath', request.assetsDirPath);

    for (const file of request.files) {
      // data 允许是 base64（含 data: 前缀）或纯文本。
      // 注意用具体类型而非 DOM 的 BlobPart —— 本项目的 tsconfig 不含 DOM lib。
      let payload: string | Uint8Array = file.data as unknown as string;
      if (typeof file.data === 'string' && file.data.startsWith('data:')) {
        const base64 = file.data.split(',')[1] || '';
        payload = new Uint8Array(Buffer.from(base64, 'base64'));
      }
      form.append('file[]', new Blob([payload]), file.name);
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    const response = await fetch(url, { method: 'POST', headers, body: form });
    const raw = await response.text();

    if (!raw || !raw.trim()) {
      return { errFiles: [], succMap: {} };
    }

    const result = JSON.parse(raw) as {
      code: number;
      msg: string;
      data: UploadAssetResponse;
    };

    if (result.code !== 0) {
      throw new Error(result.msg || 'Asset upload failed');
    }

    return result.data;
  }

  // ==================== Export APIs ====================

  /**
   * Export document as Markdown content
   */
  async exportMdContent(id: string): Promise<ExportMdContentResponse> {
    return this.request<ExportMdContentResponse>('/api/export/exportMdContent', { id });
  }

  // ==================== Import APIs ====================

  /**
   * Import standard Markdown file
   */
  async importStdMd(request: ImportStdMdRequest): Promise<ImportStdMdResponse> {
    return this.request<ImportStdMdResponse>('/api/import/importStdMd', request);
  }

  // ==================== Notebook Advanced APIs ====================

  /**
   * Create a new notebook
   */
  async createNotebook(request: CreateNotebookRequest): Promise<CreateNotebookResponse> {
    return this.request<CreateNotebookResponse>('/api/notebook/createNotebook', request);
  }

  /**
   * Close a notebook
   */
  async closeNotebook(notebook: string): Promise<void> {
    await this.request('/api/notebook/closeNotebook', { notebook });
  }

  /**
   * Remove a notebook
   */
  async removeNotebook(notebook: string): Promise<void> {
    await this.request('/api/notebook/removeNotebook', { notebook });
  }

  /**
   * Rename a notebook
   */
  async renameNotebook(notebook: string, name: string): Promise<void> {
    await this.request('/api/notebook/renameNotebook', { notebook, name });
  }

  // ==================== File Tree Advanced APIs ====================

  /**
   * Move documents
   */
  async moveDocs(request: MoveDocsRequest): Promise<MoveDocsResponse> {
    return this.request<MoveDocsResponse>('/api/filetree/moveDocs', request);
  }

  /**
   * List documents by path
   */
  async listDocsByPath(notebook: string, path: string): Promise<ListDocsByPathResponse> {
    return this.request<ListDocsByPathResponse>('/api/filetree/listDocsByPath', {
      notebook,
      path,
    });
  }

  /**
   * Get human-readable path by ID
   */
  async getHPathByID(id: string): Promise<string> {
    return this.request<string>('/api/filetree/getHPathByID', { id });
  }

  // ==================== Reference APIs ====================

  /**
   * Get backlinks for a block
   */
  async getBacklink(request: GetBacklinkRequest): Promise<GetBacklinkResponse> {
    return this.request<GetBacklinkResponse>('/api/ref/getBacklink', request);
  }

  // ==================== Block Advanced APIs ====================

  /**
   * Get child blocks (via API)
   */
  async getChildBlocksApi(id: string): Promise<Block[]> {
    const response = await this.request<GetChildBlocksResponse>('/api/block/getChildBlocks', { id });
    return response.blocks || [];
  }

  // ==================== Outline APIs ====================

  /**
   * Get document outline
   */
  async getDocOutline(id: string): Promise<GetDocOutlineResponse> {
    const raw = await this.request<any>('/api/outline/getDocOutline', { id });
    const blocks = Array.isArray(raw) ? raw : raw?.blocks ?? [];
    return { blocks };
  }

  // ==================== Tag APIs ====================

  /**
   * Get all tags (using SQL query as alternative)
   */
  async getTags(): Promise<GetTagsResponse> {
    const result = await this.sql(
      `SELECT DISTINCT tag FROM blocks WHERE tag != "" AND tag IS NOT NULL`
    );

    // Process SQL result into tags array
    const tagMap = new Map<string, number>();
    result.forEach((row: any) => {
      if (row.tag) {
        // Tags can be comma-separated
        const tags = row.tag.split(',').map((t: string) => t.trim());
        tags.forEach((tag: string) => {
          if (tag) {
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
          }
        });
      }
    });

    const tags = Array.from(tagMap.entries()).map(([name, count]) => ({
      name,
      count
    }));

    return { tags };
  }

  // ==================== Second Batch: Asset APIs ====================

  /**
   * Insert local assets
   */
  async insertLocalAssets(request: InsertLocalAssetsRequest): Promise<void> {
    await this.request('/api/asset/insertLocalAssets', request);
  }

  /**
   * Resolve asset path
   */
  async resolveAssetPath(path: string): Promise<string> {
    // ⚠️ 思源这个接口的 data **就是路径字符串本身**（例如
    // "C:\\...\\data\\assets\\foo.png"），不是 { path } 对象。
    // 曾经按 ResolveAssetPathResponse.path 取值，结果永远是 undefined。
    return this.request<string>('/api/asset/resolveAssetPath', { path });
  }

  // ==================== Template APIs ====================

  /**
   * Render template
   */
  async renderTemplate(request: RenderTemplateRequest): Promise<RenderTemplateResponse> {
    return this.request<RenderTemplateResponse>('/api/template/render', request);
  }

  /**
   * Save document as template
   */
  async docSaveAsTemplate(id: string, name: string): Promise<void> {
    await this.request('/api/template/docSaveAsTemplate', { id, name });
  }

  // ==================== Export APIs ====================

  /**
   * Export HTML
   */
  async exportHTML(request: ExportHTMLRequest): Promise<ExportHTMLResponse> {
    return this.request<ExportHTMLResponse>('/api/export/exportHTML', request);
  }

  /**
   * Batch export Markdown
   */
  async batchExportMd(request: BatchExportMdRequest): Promise<void> {
    await this.request('/api/export/batchExportMd', request);
  }

  // ==================== Import APIs ====================

  /**
   * Import data from other software
   */
  async importData(request: ImportDataRequest): Promise<void> {
    await this.request('/api/import/importData', request);
  }

  /**
   * Import notebook
   */
  async importNotebook(request: ImportNotebookRequest): Promise<void> {
    await this.request('/api/import/importNotebook', request);
  }

  // ==================== File Tree APIs ====================

  /**
   * Search documents
   */
  async searchDocs(request: SearchDocsRequest): Promise<SearchDocsResponse> {
    return this.request<SearchDocsResponse>('/api/filetree/searchDocs', request);
  }

  // ==================== Reference APIs ====================

  /**
   * Get backlink2
   */
  async getBacklink2(request: GetBacklink2Request): Promise<GetBacklinkResponse> {
    return this.request<GetBacklinkResponse>('/api/ref/getBacklink2', request);
  }

  /**
   * Get backmention
   */
  async getBackmention(id: string): Promise<GetBacklinkResponse> {
    return this.request<GetBacklinkResponse>('/api/ref/getBackmention', { id });
  }

  // ==================== History APIs ====================

  /**
   * Get document history
   */
  async getDocHistory(request: GetDocHistoryRequest): Promise<GetDocHistoryResponse> {
    return this.request<GetDocHistoryResponse>('/api/history/getDocHistoryContent', request);
  }

  /**
   * Rollback document history
   */
  async rollbackDocHistory(request: RollbackDocHistoryRequest): Promise<void> {
    await this.request('/api/history/rollbackDocHistory', request);
  }

  // ==================== Snapshot APIs ====================

  /**
   * Create snapshot
   */
  async createSnapshot(name?: string): Promise<CreateSnapshotResponse> {
    return this.request<CreateSnapshotResponse>('/api/snapshot/createSnapshot', { name });
  }

  /**
   * Rollback snapshot
   */
  async rollbackSnapshot(id: string): Promise<void> {
    await this.request('/api/snapshot/rollbackSnapshot', { id });
  }

  // ==================== Bookmark APIs ====================

  /**
   * Get bookmarks
   */
  async getBookmark(): Promise<GetBookmarkResponse> {
    const raw = await this.request<any>('/api/bookmark/getBookmark', {});
    const bookmarks = Array.isArray(raw) ? raw : raw?.bookmarks ?? [];
    return { bookmarks };
  }

  /**
   * Rename bookmark
   */
  async renameBookmark(id: string, name: string): Promise<void> {
    await this.request('/api/bookmark/renameBookmark', { id, name });
  }

  // ==================== Third Batch: Asset APIs ====================

  /**
   * Get unused assets
   */
  async getUnusedAssets(): Promise<string[]> {
    const response = await this.request<GetUnusedAssetsResponse>('/api/asset/getUnusedAssets', {});
    return response.assets || [];
  }

  /**
   * Remove unused assets
   */
  async removeUnusedAssets(assets: string[]): Promise<void> {
    await this.request('/api/asset/removeUnusedAssets', { assets });
  }

  // ==================== Template APIs ====================

  /**
   * Render Sprig template
   */
  async renderSprig(template: string): Promise<string> {
    const response = await this.request<RenderSprigResponse>('/api/template/renderSprig', { template });
    return response.content;
  }

  /**
   * Render template content
   */
  async renderTemplateContent(id: string, path: string): Promise<string> {
    const response = await this.request<RenderTemplateResponse>('/api/template/renderTemplate', { id, path });
    return response.content;
  }

  // ==================== Export APIs ====================

  /**
   * Export PDF
   */
  async exportPDF(request: ExportPDFRequest): Promise<void> {
    await this.request('/api/export/exportPDF', request);
  }

  /**
   * Export Word document
   */
  async exportDocx(request: ExportDocxRequest): Promise<void> {
    await this.request('/api/export/exportDocx', request);
  }

  // ==================== Import APIs ====================

  /**
   * Import SiYuan data
   */
  async importSY(localPath: string): Promise<void> {
    await this.request('/api/import/importSY', { localPath });
  }

  // ==================== File Tree APIs ====================

  /**
   * Get human-readable path by path
   */
  async getHPathByPath(notebook: string, path: string): Promise<string> {
    return this.request<string>('/api/filetree/getHPathByPath', { notebook, path });
  }

  // ==================== History APIs ====================

  /**
   * Get notebook history
   */
  async getNotebookHistory(notebook: string): Promise<GetNotebookHistoryResponse> {
    return this.request<GetNotebookHistoryResponse>('/api/history/getNotebookHistory', { notebook });
  }

  /**
   * Clear workspace history
   */
  async clearWorkspaceHistory(): Promise<void> {
    await this.request('/api/history/clearWorkspaceHistory', {});
  }

  // ==================== Snapshot APIs ====================

  /**
   * Remove snapshots
   */
  async removeSnapshot(ids: string[]): Promise<void> {
    await this.request('/api/snapshot/removeSnapshot', { ids });
  }

  // ==================== Sync APIs ====================

  /**
   * Perform sync
   */
  async performSync(mobileSwitch?: boolean): Promise<void> {
    await this.request('/api/sync/performSync', { mobileSwitch });
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<GetSyncStatusResponse> {
    return this.request<GetSyncStatusResponse>('/api/sync/getSyncStatus', {});
  }

  /**
   * Create cloud snapshot
   */
  async createCloudSnapshot(name?: string): Promise<void> {
    await this.request('/api/sync/createCloudSnapshot', { name });
  }

  // ==================== Other APIs ====================

  /**
   * Get shorthand (inbox) - requires specific document ID
   * Note: This API requires an id parameter in SiYuan v3.8.2
   */
  async getShorthand(id?: string): Promise<GetShorthandResponse> {
    if (!id) {
      // Try to find shorthand document via SQL
      const result = await this.sql(
        `SELECT id, content FROM blocks WHERE path LIKE '%收集箱%' OR path LIKE '%shorthand%' OR hpath LIKE '%Inbox%' LIMIT 20`
      );
      return {
        shorthand: result.map((row: any) => ({
          id: row.id,
          content: row.content
        }))
      };
    }
    return this.request<GetShorthandResponse>('/api/inbox/getShorthand', { id });
  }

  /**
   * Push notification message
   */
  async pushMsg(msg: string, timeout?: number): Promise<void> {
    await this.request('/api/notification/pushMsg', { msg, timeout });
  }

  /**
   * Push error message
   */
  async pushErrMsg(msg: string, timeout?: number): Promise<void> {
    await this.request('/api/notification/pushErrMsg', { msg, timeout });
  }

  /**
   * Get riff due cards (spaced repetition)
   */
  async getRiffDueCards(): Promise<GetRiffDueCardsResponse> {
    const raw = await this.request<any>('/api/riff/getRiffDueCards', {});
    const cards = Array.isArray(raw) ? raw : raw?.cards ?? [];
    return { cards };
  }

  /**
   * Get block breadcrumb
   */
  async getBlockBreadcrumb(id: string): Promise<GetBlockBreadcrumbResponse> {
    const raw = await this.request<any>('/api/block/getBlockBreadcrumb', { id });
    const breadcrumb = Array.isArray(raw) ? raw : raw?.breadcrumb ?? [];
    return { breadcrumb };
  }

  /**
   * Transfer block reference
   */
  async transferBlockRef(fromID: string, toID: string): Promise<void> {
    await this.request('/api/block/transferBlockRef', { fromID, toID });
  }

  // ==================== Final Batch: Remaining APIs ====================

  /**
   * Get document content (alternative to getBlockKramdown for document)
   */
  async getDoc(id: string): Promise<GetDocResponse> {
    return this.request<GetDocResponse>('/api/filetree/getDoc', { id });
  }

  /**
   * Set multiple block attributes
   */
  async setBlockAttrs(id: string, attrs: Record<string, string>): Promise<void> {
    await this.request('/api/attr/setBlockAttrs', { id, attrs });
  }

  /**
   * Open a notebook
   */
  async openNotebook(notebook: string): Promise<void> {
    await this.request('/api/notebook/openNotebook', { notebook });
  }

  /**
   * Get system configuration
   */
  async getConf(): Promise<GetConfResponse> {
    return this.request<GetConfResponse>('/api/system/getConf', {});
  }

  /**
   * Full text search blocks (alternative implementation)
   */
  async fullTextSearchBlock(query: string, types?: string[]): Promise<SearchBlocksResponse> {
    return this.request<SearchBlocksResponse>('/api/search/fullTextSearchBlock', {
      query,
      types
    });
  }

  /**
   * Export resources (package with assets)
   */
  async exportResources(path: string): Promise<ExportResourcesResponse> {
    return this.request<ExportResourcesResponse>('/api/export/exportResources', { path });
  }

  /**
   * Get detailed tag information
   */
  async getTag(tag: string): Promise<GetTagResponse> {
    return this.request<GetTagResponse>('/api/tag/getTag', { tag });
  }

  /**
   * List all available templates (using SQL to find template files)
   */
  async listTemplates(): Promise<ListTemplatesResponse> {
    // Query for template documents
    const result = await this.sql(
      `SELECT id, path, content FROM blocks WHERE type = 'd' AND path LIKE '%模板%' OR path LIKE '%template%' LIMIT 50`
    );

    const templates = result.map((row: any) => ({
      path: row.path || '',
      name: row.content || row.path || 'Untitled'
    }));

    return { templates };
  }

  /**
   * Get file tree (using listDocsByPath as alternative)
   */
  async getFileTree(notebook: string, path?: string): Promise<GetFileTreeResponse> {
    const result = await this.listDocsByPath(notebook, path || '/');
    return {
      files: result.files.map(f => ({
        id: f.id,
        name: f.name || f.name1,
        path: f.path,
        type: 'doc',
        subFileCount: f.subFileCount || 0
      }))
    };
  }

  /**
   * Get all references for a block (includes backlinks and mentions)
   */
  async getAllReferences(id: string): Promise<GetAllReferencesResponse> {
    return this.request<GetAllReferencesResponse>('/api/ref/getAllReferences', { id });
  }
}

// Export a default instance
export const createClient = (baseUrl?: string, token?: string): SiYuanClient => {
  return new SiYuanClient(baseUrl, token);
};
