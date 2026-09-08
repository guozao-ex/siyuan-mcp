/**
 * SiYuan API Type Definitions
 */

// ==================== Common Types ====================

export interface BaseResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export interface Block {
  id: string;
  parent_id?: string;
  root_id: string;
  hash: string;
  box: string;
  path: string;
  hpath: string;
  name: string;
  alias: string;
  memo: string;
  tag: string;
  content: string;
  fcontent?: string;
  markdown: string;
  length: number;
  type: BlockType;
  subtype: BlockSubType;
  ial?: string;
  sort: number;
  created: string;
  updated: string;
}

export type BlockType =
  | 'd'  // Document
  | 'h'  // Heading
  | 'p'  // Paragraph
  | 'l'  // List
  | 'i'  // List item
  | 'c'  // Code block
  | 'm'  // Math block
  | 't'  // Table
  | 'b'  // Block quote
  | 's'  // Super block
  | 'html' // HTML block
  | 'tb' // Thematic break
  | 'video' // Video
  | 'audio' // Audio
  | 'widget' // Widget
  | 'iframe'; // IFrame

export type BlockSubType =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'o' // Ordered list
  | 'u' // Unordered list
  | 't' // Task list
  | '';

// ==================== Notebook Types ====================

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  sort: number;
  closed: boolean;
  newFlashcardCount?: number;
  dueFlashcardCount?: number;
  flashcardCount?: number;
}

export interface ListNotebooksResponse {
  notebooks: Notebook[];
}

// ==================== Search Types ====================

export interface SearchBlock extends Block {
  score?: number;
}

export interface SearchBlocksRequest {
  query: string;
  types?: {
    document?: boolean;
    heading?: boolean;
    list?: boolean;
    listItem?: boolean;
    codeBlock?: boolean;
    mathBlock?: boolean;
    table?: boolean;
    blockquote?: boolean;
    superBlock?: boolean;
    paragraph?: boolean;
    htmlBlock?: boolean;
  };
  paths?: string[];
  boxes?: string[];
  method?: 0 | 1 | 2 | 3; // 0: keyword, 1: query syntax, 2: SQL, 3: regex
  groupBy?: 0 | 1; // 0: no group, 1: group by document
  orderBy?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0: block type, 1: asc by created, 2: desc by created, etc.
  page?: number;
  pageSize?: number;
}

export interface SearchBlocksResponse {
  blocks: SearchBlock[];
  matchedBlockCount: number;
  matchedRootCount: number;
  pageCount: number;
}

// ==================== Block Operations ====================

export interface GetBlockKramdownRequest {
  id: string;
}

export interface GetBlockKramdownResponse {
  id: string;
  kramdown: string;
}

export interface GetBlockAttrsRequest {
  id: string;
}

export interface GetBlockAttrsResponse {
  [key: string]: string;
}

export interface InsertBlockRequest {
  dataType: 'markdown' | 'dom';
  data: string;
  nextID?: string;
  previousID?: string;
  parentID?: string;
}

export interface InsertBlockResponse {
  doOperations: Array<{
    action: string;
    id: string;
    data: string;
  }>;
}

export interface UpdateBlockRequest {
  dataType: 'markdown' | 'dom';
  data: string;
  id: string;
}

export interface UpdateBlockResponse {
  doOperations: Array<{
    action: string;
    id: string;
    data: string;
  }>;
}

export interface DeleteBlockRequest {
  id: string;
}

export interface DeleteBlockResponse {
  doOperations: Array<{
    action: string;
    id: string;
  }>;
}

// ==================== Document Operations ====================

export interface CreateDocWithMdRequest {
  notebook: string;
  path: string;
  markdown: string;
}

// Note: The API returns the document ID as a string directly, not an object
export type CreateDocWithMdResponse = string;

export interface GetDocInfoRequest {
  id: string;
}

export interface GetDocInfoResponse {
  id: string;
  rootID: string;
  name: string;
  refCount: number;
  subFileCount: number;
  refIDs: string[];
}

export interface RenameDocRequest {
  notebook: string;
  path: string;
  title: string;
}

export interface RenameDocResponse {
  id: string;
}

export interface RemoveDocRequest {
  notebook: string;
  path: string;
}

export interface RemoveDocResponse {
  id: string;
}

// ==================== SQL Query ====================

export interface SqlQueryRequest {
  stmt: string;
}

export interface SqlQueryResponse {
  code: number;
  msg: string;
  data: Array<{ [key: string]: any }>;
}

// ==================== System ====================

export interface VersionResponse {
  version: string;
}

export interface BootProgressResponse {
  progress: number;
  details: string;
}

// ==================== API Error ====================

export class SiYuanApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SiYuanApiError';
  }
}

// ==================== Asset APIs ====================

export interface UploadAssetRequest {
  assetsDirPath: string;
  files: Array<{
    name: string;
    data: Buffer | string; // Buffer for binary, base64 string
  }>;
}

export interface UploadAssetResponse {
  errFiles: string[];
  succMap: { [key: string]: string }; // filename -> asset path
}

// ==================== Export APIs ====================

export interface ExportMdContentRequest {
  id: string;
}

export interface ExportMdContentResponse {
  id: string;
  hPath: string;
  content: string;
}

// ==================== Import APIs ====================

export interface ImportStdMdRequest {
  notebook: string;
  localPath: string;
  toPath: string;
}

export interface ImportStdMdResponse {
  id: string;
}

// ==================== Notebook APIs ====================

export interface CreateNotebookRequest {
  name: string;
  icon?: string;
  sort?: number;
  closed?: boolean;
}

export interface CreateNotebookResponse {
  id: string;
  name: string;
}

export interface CloseNotebookRequest {
  notebook: string;
}

export interface RemoveNotebookRequest {
  notebook: string;
}

export interface RenameNotebookRequest {
  notebook: string;
  name: string;
}

// ==================== File Tree APIs ====================

export interface MoveDocsRequest {
  fromNotebook: string;
  fromPath: string;
  toNotebook: string;
  toPath: string;
}

export interface MoveDocsResponse {
  id: string;
}

export interface ListDocsByPathRequest {
  notebook: string;
  path: string;
}

export interface ListDocsByPathResponse {
  files: Array<{
    path: string;
    name: string;
    icon: string;
    name1: string;
    alias: string;
    memo: string;
    bookmark: string;
    id: string;
    count: number;
    subFileCount: number;
  }>;
}

export interface GetHPathByIDRequest {
  id: string;
}

export interface GetHPathByIDResponse {
  hPath: string;
}

// ==================== Reference APIs ====================

export interface GetBacklinkRequest {
  id: string;
  k?: string;
  mk?: string;
}

export interface GetBacklinkResponse {
  backlinks: Array<{
    id: string;
    block: Block;
    blockPaths: Array<{
      id: string;
      name: string;
      type: string;
    }>;
    dom: string;
  }>;
  linkRefsCount: number;
  mentionsCount: number;
}

// ==================== Block APIs ====================

export interface GetChildBlocksRequest {
  id: string;
}

export interface GetChildBlocksResponse {
  id: string;
  blocks: Block[];
}

// ==================== Outline APIs ====================

export interface GetDocOutlineRequest {
  id: string;
}

export interface GetDocOutlineResponse {
  blocks: Array<{
    id: string;
    name: string;
    type: string;
    depth: number;
    count: number;
  }>;
}

// ==================== Tag APIs ====================

export interface GetTagsResponse {
  tags: Array<{
    name: string;
    count: number;
  }>;
}

// ==================== Second Batch APIs ====================

// Asset APIs
export interface InsertLocalAssetsRequest {
  assetPaths: string[];
  id: string;
}

export interface ResolveAssetPathRequest {
  path: string;
}

export interface ResolveAssetPathResponse {
  path: string;
}

// Template APIs
export interface RenderTemplateRequest {
  id: string;
  path: string;
}

export interface RenderTemplateResponse {
  content: string;
  path: string;
}

// Export APIs
export interface ExportHTMLRequest {
  id: string;
  pdf?: boolean;
  savePath?: string;
}

export interface ExportHTMLResponse {
  zip?: string;
  html?: string;
}

export interface BatchExportMdRequest {
  notebook: string;
  path: string;
}

// Import APIs
export interface ImportDataRequest {
  notebook: string;
  localPath: string;
  toPath: string;
}

export interface ImportNotebookRequest {
  localPath: string;
}

// File Tree APIs
export interface SearchDocsRequest {
  k: string;
  notebook?: string;
}

export interface SearchDocsResponse {
  docs: Array<{
    id: string;
    path: string;
    box: string;
    hPath: string;
  }>;
}

// Reference APIs
export interface GetBacklink2Request {
  id: string;
  beforeLen?: number;
}

export interface GetBackmentionRequest {
  id: string;
}

// History APIs
export interface GetDocHistoryRequest {
  notebook: string;
  path: string;
}

export interface GetDocHistoryResponse {
  histories: Array<{
    path: string;
    title: string;
    created: string;
  }>;
}

export interface RollbackDocHistoryRequest {
  notebook: string;
  path: string;
  historyPath: string;
}

// Snapshot APIs
export interface CreateSnapshotRequest {
  name?: string;
}

export interface CreateSnapshotResponse {
  id: string;
}

export interface RollbackSnapshotRequest {
  id: string;
}

// Bookmark APIs
export interface GetBookmarkResponse {
  bookmarks: Array<{
    id: string;
    name: string;
    path: string;
  }>;
}

// ==================== Third Batch: Low Priority APIs ====================

// Asset APIs (remaining)
export interface GetUnusedAssetsResponse {
  assets: string[];
}

export interface RemoveUnusedAssetsRequest {
  assets: string[];
}

// Template APIs (remaining)
export interface RenderSprigRequest {
  template: string;
}

export interface RenderSprigResponse {
  content: string;
}

// Export APIs (remaining)
export interface ExportPDFRequest {
  id: string;
  savePath?: string;
}

export interface ExportDocxRequest {
  id: string;
  savePath?: string;
}

// Import APIs (remaining)
export interface ImportSYRequest {
  localPath: string;
}

// File Tree APIs (remaining)
export interface GetHPathByPathRequest {
  notebook: string;
  path: string;
}

export interface GetHPathByPathResponse {
  hPath: string;
}

// History APIs (remaining)
export interface GetNotebookHistoryRequest {
  notebook: string;
}

export interface GetNotebookHistoryResponse {
  histories: Array<{
    hPath: string;
    items: Array<{
      path: string;
      title: string;
      created: string;
    }>;
  }>;
}

// Snapshot APIs (remaining)
export interface RemoveSnapshotRequest {
  ids: string[];
}

// Sync APIs
export interface PerformSyncRequest {
  mobileSwitch?: boolean;
}

export interface GetSyncStatusResponse {
  syncing: boolean;
  stat: string;
}

export interface CreateCloudSnapshotRequest {
  name?: string;
}

// Other APIs
export interface GetShorthandResponse {
  shorthand: Array<{
    id: string;
    content: string;
  }>;
}

export interface PushMsgRequest {
  msg: string;
  timeout?: number;
}

export interface GetRiffDueCardsResponse {
  cards: Array<{
    id: string;
    blockID: string;
  }>;
}

export interface GetBlockBreadcrumbRequest {
  id: string;
}

export interface GetBlockBreadcrumbResponse {
  breadcrumb: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export interface TransferBlockRefRequest {
  fromID: string;
  toID: string;
}

// Additional Block APIs
export interface GetBlockChildrenRequest {
  id: string;
}

export interface GetBlockChildrenResponse {
  children: Block[];
}
