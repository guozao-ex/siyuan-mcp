/**
 * MCP 工具注册表 —— 工具信息的**唯一数据源**。
 *
 * 为什么需要它：
 * 在此之前，同一批工具的信息散落在三处且已经不同步：
 *   1. src/index.ts 的 TOOLS 常量（stdio 模式的 tools/list）
 *   2. src/utils/http-server.ts 的 GET /tools 返回的字符串数组（少了 batch 系列）
 *   3. src/utils/http-server.ts 的 handleToolCall() switch（同样少了 batch 系列）
 * 结果是两种传输模式对外暴露的工具集不一致。
 *
 * 现在所有消费方都从这里派生：
 *   - stdio   : TOOL_SCHEMAS -> tools/list，invokeTool -> 执行
 *   - http    : TOOL_NAMES   -> GET /tools，invokeTool -> POST /tools/call
 * 新增一个工具只需要在本文件加一条。
 */
import type { SiYuanClient } from '../siyuan/api.js';
import { searchNotes, listNotebooks } from './search.js';
import { readBlock, readDocument, readBlocks, readByPath } from './read.js';
import {
  createDocument,
  updateBlock,
  appendBlock,
  insertBlockBefore,
  insertBlockAfter,
  deleteBlock,
  renameDocument,
  deleteDocument,
  appendToDocument,
} from './write.js';
import {
  getBacklinks,
  getBlockBreadcrumb,
  getDocOutline,
  getTags,
  getBlocksByTag,
  listDocsByPath,
} from './navigate.js';
import { EXTRA_TOOL_DEFINITIONS } from './registry-extra.js';
import { DANGEROUS_TOOL_DEFINITIONS } from './registry-dangerous.js';
import { BatchOperations } from '../core/batch-operations.js';

/** 工具入参（由客户端按 inputSchema 提供，因此这里是宽松类型） */
export type ToolArgs = Record<string, any>;

/**
 * 把「文档 id」解析成思源 filetree API 需要的 (notebook, path)。
 *
 * rename_document / delete_document 底层用的是 `/api/filetree/renameDoc|removeDoc`，
 * 只认 notebook + path；而调用方（通常是 AI Agent）手里往往只有文档 id。
 * 这里做一次反查，省掉"先 search 再删"的两步操作。
 */
async function resolveDocLocation(
  client: SiYuanClient,
  args: { id?: string; notebook?: string; path?: string }
): Promise<{ notebook: string; path: string }> {
  if (args.notebook && args.path) {
    return { notebook: args.notebook, path: args.path };
  }
  if (!args.id) {
    throw new Error('需要提供 id，或同时提供 notebook 与 path');
  }

  const safeId = String(args.id).replace(/'/g, "''");
  const rows = await client.sql(
    `SELECT box, path FROM blocks WHERE id = '${safeId}' LIMIT 1`
  );
  if (!rows || rows.length === 0) {
    throw new Error(
      `找不到文档：${args.id}（若该文档是刚创建的，可能是索引尚未就绪，稍后重试）`
    );
  }
  return { notebook: String(rows[0].box), path: String(rows[0].path) };
}

export interface ToolDefinition {
  /** 对外暴露的工具名（稳定契约，不要随意更改） */
  name: string;
  /** 给模型看的描述 */
  description: string;
  /** 入参的 JSON Schema（结构与 MCP SDK 的 Tool["inputSchema"] 兼容） */
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  /**
   * 给客户端的风险提示（对应 MCP 协议的 ToolAnnotations）。
   *
   * 约定：
   *   - `readOnlyHint: true`     只读取，不修改任何内容
   *   - `destructiveHint: false` 只新增/追加，不覆盖既有内容
   *   - `destructiveHint: true`  会覆盖或删除既有内容（**执行前应先取得用户确认**）
   *
   * ⚠️ 协议明确规定这些只是**提示**：客户端不应据此做安全决策，服务端也不会据此
   * 改变行为。因此凡是"需要用户确认再执行"的操作，必须在 description 里写清楚，
   * 不能只靠标注。
   */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
  /** 实际执行逻辑 */
  handler: (client: SiYuanClient, args: ToolArgs) => Promise<unknown>;
}

/** 全部工具定义 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'search_notes',
    description: 'Search notes and blocks in SiYuan by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query keyword',
        },
        notebooks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Filter by notebook IDs',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        pageSize: {
          type: 'number',
          description: 'Results per page (default: 20, max: 100)',
        },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => searchNotes(client, args as any),
  },
  {
    name: 'list_notebooks',
    description: 'List all notebooks in SiYuan',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true },
    handler: (client) => listNotebooks(client),
  },
  {
    name: 'read_block',
    description: 'Read a single block by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Block ID',
        },
        includeAttributes: {
          type: 'boolean',
          description: 'Include block attributes (default: false)',
        },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => readBlock(client, args as any),
  },
  {
    name: 'read_document',
    description: 'Read a complete document (note) by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Document ID',
        },
        includeChildren: {
          type: 'boolean',
          description: 'Include all child blocks (default: true)',
        },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => readDocument(client, args as any),
  },
  {
    name: 'create_document',
    description: 'Create a new document in SiYuan',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: {
          type: 'string',
          description: 'Notebook ID',
        },
        path: {
          type: 'string',
          description: 'Document path (e.g., /folder/document.sy)',
        },
        title: {
          type: 'string',
          description: 'Document title',
        },
        content: {
          type: 'string',
          description: 'Document content in markdown (optional)',
        },
      },
      required: ['notebook', 'path', 'title'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => createDocument(client, args as any),
  },
  {
    name: 'update_block',
    description: '⚠️ DESTRUCTIVE — ASK THE USER FIRST: overwrites the existing content of a block; ' + 
      'the previous text is replaced. Confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Block ID to update',
        },
        content: {
          type: 'string',
          description: 'New content in markdown',
        },
      },
      required: ['id', 'content'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => updateBlock(client, args as any),
  },
  {
    name: 'append_block',
    description: 'Append content to a block (add as child)',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'Parent block ID',
        },
        content: {
          type: 'string',
          description: 'Content to append in markdown',
        },
      },
      required: ['parentId', 'content'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => appendBlock(client, args as any),
  },
  {
    name: 'delete_block',
    description: '⚠️ DESTRUCTIVE — ASK THE USER FIRST: permanently removes a block and its content.' + 
      'Do not call this without explicit user confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Block ID to delete',
        },
      },
      required: ['id'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => deleteBlock(client, args as any),
  },
  {
    name: 'batch_insert_blocks',
    description: 'Insert multiple blocks at once with concurrency control',
    inputSchema: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          description: 'Array of blocks to insert',
          items: {
            type: 'object',
            properties: {
              dataType: {
                type: 'string',
                enum: ['markdown', 'dom'],
                description: 'Block data type',
              },
              data: {
                type: 'string',
                description: 'Block content',
              },
              parentID: {
                type: 'string',
                description: 'Parent block ID',
              },
              previousID: {
                type: 'string',
                description: 'Previous sibling block ID (optional)',
              },
            },
            required: ['dataType', 'data', 'parentID'],
          },
        },
        concurrency: {
          type: 'number',
          description: 'Max concurrent operations (default: 5)',
        },
        stopOnError: {
          type: 'boolean',
          description: 'Stop if any operation fails (default: false)',
        },
      },
      required: ['blocks'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) =>
      new BatchOperations(client).insertBlocksBatch(args.blocks, {
        concurrency: args.concurrency,
        stopOnError: args.stopOnError,
      }),
  },
  {
    name: 'batch_update_blocks',
    description: '⚠️ DESTRUCTIVE — ASK THE USER FIRST: overwrites the content of several blocks in one ' + 
      'call. Confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          description: 'Array of block updates',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Block ID',
              },
              dataType: {
                type: 'string',
                enum: ['markdown', 'dom'],
              },
              data: {
                type: 'string',
                description: 'New block content',
              },
            },
            required: ['id', 'dataType', 'data'],
          },
        },
        concurrency: {
          type: 'number',
          description: 'Max concurrent operations (default: 5)',
        },
      },
      required: ['updates'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) =>
      new BatchOperations(client).updateBlocksBatch(args.updates, {
        concurrency: args.concurrency,
      }),
  },
  {
    name: 'batch_delete_blocks',
    description: '⚠️ DESTRUCTIVE — ASK THE USER FIRST: removes several blocks in one call.' + 
      'Do not call this without explicit user confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        blockIds: {
          type: 'array',
          description: 'Array of block IDs to delete',
          items: {
            type: 'string',
          },
        },
        concurrency: {
          type: 'number',
          description: 'Max concurrent operations (default: 5)',
        },
      },
      required: ['blockIds'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) =>
      new BatchOperations(client).deleteBlocksBatch(args.blockIds, {
        concurrency: args.concurrency,
      }),
  },
  {
    name: 'batch_set_attrs',
    description: 'Set attributes for multiple blocks at once. Overwrites existing values of the same ' + 
      'attribute keys — confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          description: 'Array of attribute updates',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Block ID',
              },
              attrs: {
                type: 'object',
                description: 'Attributes to set',
              },
            },
            required: ['id', 'attrs'],
          },
        },
        concurrency: {
          type: 'number',
          description: 'Max concurrent operations (default: 10)',
        },
      },
      required: ['updates'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) =>
      new BatchOperations(client).setBlockAttrsBatch(args.updates, {
        concurrency: args.concurrency,
      }),
  },

  // ==================== 批量读 / 按路径读 ====================
  {
    name: 'read_blocks',
    description:
      'Read multiple blocks at once by their IDs. Returns an array of block contents.' +
      'Individual blocks that fail to read are skipped instead of failing the whole call.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of block IDs to read',
        },
        includeAttributes: {
          type: 'boolean',
          description: 'Include block attributes (default: false)',
        },
      },
      required: ['ids'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => readBlocks(client, args as any),
  },
  {
    name: 'read_by_path',
    description:
      'Find and read blocks by a human-readable path or title fragment.' +
      'Use this when you know the note path/title but not its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Human-readable path or title fragment to look for',
        },
        notebook: {
          type: 'string',
          description: 'Optional: restrict the search to one notebook ID',
        },
      },
      required: ['path'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => readByPath(client, args as any),
  },

  // ==================== 精确位置插入 ====================
  {
    name: 'insert_block_after',
    description:
      'Insert content immediately AFTER an existing block, as its sibling.' +
      'Use append_block instead when you just want to add to the end of a parent.',
    inputSchema: {
      type: 'object',
      properties: {
        previousId: { type: 'string', description: 'The block to insert after' },
        content: { type: 'string', description: 'Content in markdown' },
      },
      required: ['previousId', 'content'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => insertBlockAfter(client, args as any),
  },
  {
    name: 'insert_block_before',
    description: 'Insert content immediately BEFORE an existing block, as its sibling.',
    inputSchema: {
      type: 'object',
      properties: {
        nextId: { type: 'string', description: 'The block to insert before' },
        content: { type: 'string', description: 'Content in markdown' },
      },
      required: ['nextId', 'content'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => insertBlockBefore(client, args as any),
  },
  {
    name: 'append_to_document',
    description:
      'Append content to the END of a document. A convenience wrapper over append_block ' +
      'that makes the intent explicit when the target is a whole document.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Target document ID' },
        content: { type: 'string', description: 'Content in markdown' },
      },
      required: ['documentId', 'content'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => appendToDocument(client, args as any),
  },

  // ==================== 文档重命名 / 删除 ====================
  {
    name: 'rename_document',
    description:
      'Rename a document. Provide either `id`, or both `notebook` and `path` — ' +
      'the ID form is usually easier, the server resolves notebook/path for you.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID (preferred)' },
        notebook: { type: 'string', description: 'Notebook ID (only if the path form is used)' },
        path: { type: 'string', description: 'Document path (only if id is not given)' },
        newTitle: { type: 'string', description: 'New document title' },
      },
      required: ['newTitle'],
    },
    annotations: { destructiveHint: false },
    handler: async (client, args) => {
      const { notebook, path } = await resolveDocLocation(client, args as any);
      return renameDocument(client, { notebook, path, newTitle: args.newTitle, id: args.id });
    },
  },
  {
    name: 'delete_document',
    description:
      '⚠️ DESTRUCTIVE: delete a whole document. It goes to the SiYuan trash and can be ' +
      'restored from there. Provide either `id`, or both `notebook` and `path``. ' +
      'Use delete_block instead when you only need to remove a single block.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID (preferred)' },
        notebook: { type: 'string', description: 'Notebook ID (only if the path form is used)' },
        path: { type: 'string', description: 'Document path (only if id is not given)' },
      },
      required: [],
    },
    annotations: { destructiveHint: true },
    handler: async (client, args) => {
      const { notebook, path } = await resolveDocLocation(client, args as any);
      return deleteDocument(client, { notebook, path, id: args.id });
    },
  },

  // ==================== 导航与关系（全部只读）====================
  // 这几个工具解决的是「Agent 只能靠关键词盲搜」的问题：
  // 双链关系、块的上下文位置、文档结构、标签，都是思源最有价值的信息。
  {
    name: 'get_backlinks',
    description:
      'Get references pointing TO a block/document: backlinks (explicit refs) and backmentions ' +
      '(plain-text mentions). Use this to understand how a note relates to the rest of the ' +
      'workspace — the backlink graph is the core value of SiYuan.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Target block or document ID' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getBacklinks(client, args as any),
  },
  {
    name: 'get_block_breadcrumb',
    description:
      'Get the breadcrumb (position) of a block within its document.' +
      'A cheap way to learn a block\u2019s context without reading the whole document.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Block ID' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getBlockBreadcrumb(client, args as any),
  },
  {
    name: 'get_doc_outline',
    description:
      'Get the heading outline of a document. Grasp the structure first, then read only the ' +
      'relevant sections instead of pulling in the whole document.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getDocOutline(client, args as any),
  },
  {
    name: 'get_tags',
    description:
      'List all tags in the workspace with their block counts, sorted by frequency.' +
      'Optionally filter by a keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional: only return tags whose name contains this text',
        },
      },
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getTags(client, args as any),
  },
  {
    name: 'get_blocks_by_tag',
    description: 'List the blocks carrying a given tag.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Tag name' },
      },
      required: ['tag'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getBlocksByTag(client, args as any),
  },
  {
    name: 'list_docs_by_path',
    description:
      'List the documents directly under a notebook path. Together with read_document this ' +
      'enables a "map first, then dive in" workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
        path: { type: 'string', description: 'Path inside the notebook (default: /)' },
      },
      required: ['notebook'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => listDocsByPath(client, args as any),
  },

  // ==================== 扩展工具 ====================
  // 见 registry-extra.ts：路径 / 结构 / 搜索 / 系统状态 / 资源 / 笔记本等。
  // 高危操作（删除、回滚、导入覆盖、触发同步、读取配置）刻意不在这里。
  ...EXTRA_TOOL_DEFINITIONS,

  // ==================== 高危工具（作者逐项授权）====================
  // 删除 / 回滚 / 导入 / 导出 / 触发同步 / 读配置 / 弹通知。
  // 每个都标 destructiveHint，并在 description 里写明 ASK THE USER FIRST。
  ...DANGEROUS_TOOL_DEFINITIONS,
];

/** 工具名列表（HTTP 的 GET /tools 用它，保证与 stdio 完全一致） */
export const TOOL_NAMES: readonly string[] = TOOL_DEFINITIONS.map((t) => t.name);

/** 只含元信息的工具描述（stdio 的 tools/list 与 HTTP 的 /api/tools 都用它） */
export const TOOL_SCHEMAS = TOOL_DEFINITIONS.map(
  ({ name, description, inputSchema, annotations }) => ({
    name,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
  })
);

/** 按名查找工具定义 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

/**
 * 统一的工具调用入口。
 * 找不到工具时抛出明确错误（调用方负责转成协议层错误响应）。
 */
export async function invokeTool(
  client: SiYuanClient,
  name: string,
  args: ToolArgs = {}
): Promise<unknown> {
  const tool = getToolDefinition(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(client, args ?? {});
}
