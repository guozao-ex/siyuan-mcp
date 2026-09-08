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

export class SiYuanClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl || process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';
    this.token = token || process.env.SIYUAN_API_TOKEN || '';

    // Remove trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Generic request method
   */
  private async request<T>(endpoint: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data || {}),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: BaseResponse<T> = await response.json();

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
   * List all notebooks
   */
  async listNotebooks(): Promise<ListNotebooksResponse> {
    return this.request<ListNotebooksResponse>('/api/notebook/lsNotebooks');
  }

  // ==================== Search APIs ====================

  /**
   * Search blocks
   */
  async searchBlocks(request: SearchBlocksRequest): Promise<SearchBlocksResponse> {
    return this.request<SearchBlocksResponse>('/api/search/searchBlock', request);
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
   * Get block kramdown (markdown) content
   */
  async getBlockKramdown(id: string): Promise<GetBlockKramdownResponse> {
    return this.request<GetBlockKramdownResponse>('/api/block/getBlockKramdown', { id });
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
   * Update an existing block
   */
  async updateBlock(request: UpdateBlockRequest): Promise<UpdateBlockResponse> {
    return this.request<UpdateBlockResponse>('/api/block/updateBlock', request);
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
    return result.rows || [];
  }

  // ==================== SQL APIs ====================

  /**
   * Execute SQL query
   */
  async sql(stmt: string): Promise<SqlQueryResponse> {
    return this.request<SqlQueryResponse>('/api/query/sql', { stmt });
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
