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
} from './types.js';
import { createCache, Cache } from '../utils/cache.js';

export class SiYuanClient {
  private baseUrl: string;
  private token: string;
  private cache: Cache;

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
  }

  /**
   * Generic request method
   */
  private async request<T>(endpoint: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data || {}, (key, value) => {
          // Ensure strings are properly encoded
          if (typeof value === 'string') {
            return value;
          }
          return value;
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as BaseResponse<T>;

      if (result.code !== 0) {
        const error = new Error(result.msg) as SiYuanApiError;
        error.name = 'SiYuanApiError';
        error.code = result.code;
        error.details = result.data;
        throw error;
      }

      return result.data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
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
   */
  async insertBlock(request: InsertBlockRequest): Promise<InsertBlockResponse> {
    return this.request<InsertBlockResponse>('/api/block/insertBlock', request);
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
   */
  async appendBlock(
    parentID: string,
    markdown: string
  ): Promise<InsertBlockResponse> {
    return this.insertBlock({
      dataType: 'markdown',
      data: markdown,
      parentID,
    });
  }

  /**
   * Prepend block to parent
   */
  async prependBlock(
    parentID: string,
    markdown: string
  ): Promise<InsertBlockResponse> {
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
   */
  async createDocWithMd(
    notebook: string,
    path: string,
    markdown: string
  ): Promise<CreateDocWithMdResponse> {
    return this.request<CreateDocWithMdResponse>('/api/filetree/createDocWithMd', {
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
   */
  async renameDoc(
    notebook: string,
    path: string,
    title: string
  ): Promise<RenameDocResponse> {
    return this.request<RenameDocResponse>('/api/filetree/renameDoc', {
      notebook,
      path,
      title,
    });
  }

  /**
   * Remove document
   */
  async removeDoc(notebook: string, path: string): Promise<RemoveDocResponse> {
    return this.request<RemoveDocResponse>('/api/filetree/removeDoc', {
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
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Export a default instance
export const createClient = (baseUrl?: string, token?: string): SiYuanClient => {
  return new SiYuanClient(baseUrl, token);
};
