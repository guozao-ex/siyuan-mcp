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
