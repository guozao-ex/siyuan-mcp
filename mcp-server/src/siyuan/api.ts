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

  // ==================== Asset APIs ====================

  /**
   * Upload asset files
   */
  async uploadAsset(request: UploadAssetRequest): Promise<UploadAssetResponse> {
    return this.request<UploadAssetResponse>('/api/asset/upload', request);
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
    const response = await this.request<GetHPathByIDResponse>('/api/filetree/getHPathByID', { id });
    return response.hPath;
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
    return this.request<GetDocOutlineResponse>('/api/outline/getDocOutline', { id });
  }

  // ==================== Tag APIs ====================

  /**
   * Get all tags
   */
  async getTags(): Promise<GetTagsResponse> {
    return this.request<GetTagsResponse>('/api/tag/getTags', {});
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
    const response = await this.request<ResolveAssetPathResponse>('/api/asset/resolveAssetPath', { path });
    return response.path;
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
    return this.request<GetBookmarkResponse>('/api/bookmark/getBookmark', {});
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
    const response = await this.request<GetHPathByPathResponse>('/api/filetree/getHPathByPath', {
      notebook,
      path,
    });
    return response.hPath;
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
   * Get shorthand (inbox)
   */
  async getShorthand(): Promise<GetShorthandResponse> {
    return this.request<GetShorthandResponse>('/api/inbox/getShorthand', {});
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
    return this.request<GetRiffDueCardsResponse>('/api/riff/getRiffDueCards', {});
  }

  /**
   * Get block breadcrumb
   */
  async getBlockBreadcrumb(id: string): Promise<GetBlockBreadcrumbResponse> {
    return this.request<GetBlockBreadcrumbResponse>('/api/block/getBlockBreadcrumb', { id });
  }

  /**
   * Transfer block reference
   */
  async transferBlockRef(fromID: string, toID: string): Promise<void> {
    await this.request('/api/block/transferBlockRef', { fromID, toID });
  }
}

// Export a default instance
export const createClient = (baseUrl?: string, token?: string): SiYuanClient => {
  return new SiYuanClient(baseUrl, token);
};
