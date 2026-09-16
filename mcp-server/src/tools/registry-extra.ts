/**
 * 扩展工具集：把此前"封装了但没暴露"的能力补全为 MCP 工具。
 *
 * 分成三组，风险等级与 registry.ts 的约定一致：
 *   - 只读（readOnlyHint: true）
 *   - 非破坏写（destructiveHint: false）：只新增/追加，不覆盖既有内容
 *   - 破坏性（destructiveHint: true）：会覆盖既有值
 *
 * ⚠️ 高危操作（删除笔记本、删除未使用资源、删除/回滚快照、回滚文档历史、
 * 清空工作空间历史、导入覆盖、触发同步、读取配置）**刻意不在这里** ——
 * 它们需要用户逐次授权，不能默认暴露给模型。
 */
import type { SiYuanClient } from '../siyuan/api.js';
import type { ToolDefinition, ToolArgs } from './registry.js';
import {
  getPath,
  getFileTree,
  getChildBlocks,
  searchDocs,
  searchFulltext,
  exportMarkdown,
  renderTemplate,
} from './navigate.js';
import {
  getSystemInfo,
  getSyncStatus,
  getHistory,
  listTemplates,
  getBookmarks,
  getDueCards,
  getShorthand,
} from './system.js';
import {
  createNotebook,
  renameNotebook,
  openNotebook,
  closeNotebook,
  moveDocuments,
  resolveAssetPath,
  listUnusedAssets,
  uploadAsset,
  insertLocalAssets,
  saveAsTemplate,
  createSnapshot,
  renameBookmark,
  transferBlockRef,
} from './library.js';
import { prependBlock, setBlockAttrs } from './write.js';

export const EXTRA_TOOL_DEFINITIONS: ToolDefinition[] = [
  // ==================== 路径 / 结构 / 搜索 / 导出（只读）====================
  {
    name: 'get_path',
    description:
      'Resolve the human-readable path (hpath) of a block/document. ' +
      'Give either `id`, or both `notebook` and `path`. Useful for turning IDs into ' +
      'paths you can show a user.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Block or document ID' },
        notebook: { type: 'string', description: 'Notebook ID (only with the path form)' },
        path: { type: 'string', description: 'Document path (only with the notebook form)' },
      },
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getPath(client, args as any),
  },
  {
    name: 'get_file_tree',
    description:
      'Get the full file tree (including sub-documents) under a notebook path. ' +
      'Use list_docs_by_path for just one level.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
        path: { type: 'string', description: 'Path inside the notebook (default: /)' },
      },
      required: ['notebook'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getFileTree(client, args as any),
  },
  {
    name: 'get_child_blocks',
    description: 'Get the direct child blocks of a block (its immediate contents).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Parent block ID' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getChildBlocks(client, args as any),
  },
  {
    name: 'search_docs',
    description:
      'Search documents by keyword and get back **document-level** hits (not blocks). ' +
      'Use this when you want to find which notes exist rather than specific paragraphs.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Keyword to search for' },
        notebook: { type: 'string', description: 'Optional: restrict to one notebook' },
      },
      required: ['keyword'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => searchDocs(client, args as any),
  },
  {
    name: 'search_fulltext',
    description:
      'Full-text search over blocks using SiYuan\u2019s own index. Compared with search_notes ' +
      '(which does a SQL LIKE match), this handles Chinese word segmentation and relevance ' +
      'ranking better — prefer it for "find the most relevant notes about X".',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: restrict to block types, e.g. ["p","h","l"]',
        },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => searchFulltext(client, args as any),
  },
  {
    name: 'export_markdown',
    description: 'Export a document\u2019s Markdown content (read-only — writes nothing to disk).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => exportMarkdown(client, args as any),
  },
  {
    name: 'render_template',
    description:
      'Render a SiYuan template. Three modes: `sprig` (render a Sprig snippet), ' +
      '`template` (render template text), or `id` + `path` (render a template file).',
    inputSchema: {
      type: 'object',
      properties: {
        sprig: { type: 'string', description: 'A Sprig snippet to render' },
        template: { type: 'string', description: 'Template text to render' },
        id: { type: 'string', description: 'Block ID (with path, for the template-file mode)' },
        path: { type: 'string', description: 'Template path (with id)' },
      },
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => renderTemplate(client, args as any),
  },

  // ==================== 系统状态（只读）====================
  {
    name: 'get_system_info',
    description:
      'Get SiYuan version, boot progress and connection status in one call. ' +
      'Handy to confirm the kernel is alive before doing work.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getSystemInfo(client, args as any),
  },
  {
    name: 'get_sync_status',
    description: 'Get the cloud sync status (empty when sync is not enabled).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getSyncStatus(client, args as any),
  },
  {
    name: 'get_history',
    description:
      'List history entries. Pass `path` for a single document\u2019s versions, or only ' +
      '`notebook` for the notebook-level history. This only **lists** — rolling back is a ' +
      'destructive operation and is deliberately not exposed.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
        path: { type: 'string', description: 'Optional: document path for version history' },
      },
      required: ['notebook'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getHistory(client, args as any),
  },
  {
    name: 'list_templates',
    description: 'List the template files available in the workspace.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => listTemplates(client, args as any),
  },
  {
    name: 'get_bookmarks',
    description: 'List all bookmarks in the workspace.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getBookmarks(client, args as any),
  },
  {
    name: 'get_due_cards',
    description: 'List the spaced-repetition (Riff) cards due today.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getDueCards(client, args as any),
  },
  {
    name: 'get_shorthand',
    description:
      'Get "mentions" — places where a block\u2019s title is mentioned in plain text without a ' +
      'real reference link. Complements get_backlinks (which covers real references).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional: block ID to scope the lookup' },
      },
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getShorthand(client, args as any),
  },

  // ==================== 资源（只读 + 新增）====================
  {
    name: 'resolve_asset_path',
    description: 'Resolve an asset path into an accessible URL.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Asset path, e.g. assets/foo.png' },
      },
      required: ['path'],
    },
    annotations: { readOnlyHint: true },
    handler: (client, args) => resolveAssetPath(client, args as any),
  },
  {
    name: 'list_unused_assets',
    description:
      'List assets (images, attachments) that no document references. **Read-only** — ' +
      'it never deletes anything; deleting unused assets is a destructive operation that ' +
      'is deliberately not exposed.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => listUnusedAssets(client, args as any),
  },

  // ==================== 非破坏性写操作 ====================
  {
    name: 'prepend_block',
    description:
      'Insert content at the **beginning** of a parent block (the counterpart of append_block). ' +
      'Additive only — nothing is overwritten.',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'string', description: 'Parent block ID' },
        content: { type: 'string', description: 'Content in markdown' },
      },
      required: ['parentId', 'content'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => prependBlock(client, args as any),
  },
  {
    name: 'create_notebook',
    description: 'Create a new notebook. Additive — existing notebooks are untouched.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Notebook name' },
        icon: { type: 'string', description: 'Optional icon' },
      },
      required: ['name'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => createNotebook(client, args as any),
  },
  {
    name: 'rename_notebook',
    description: 'Rename a notebook. Only the name changes; contents are untouched.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
        name: { type: 'string', description: 'New name' },
      },
      required: ['notebook', 'name'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => renameNotebook(client, args as any),
  },
  {
    name: 'open_notebook',
    description: 'Open a notebook so it appears in the file tree.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
      },
      required: ['notebook'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => openNotebook(client, args as any),
  },
  {
    name: 'close_notebook',
    description:
      'Close a notebook (collapse it in the current session). This does **not** delete ' +
      'anything — contents stay on disk.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
      },
      required: ['notebook'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => closeNotebook(client, args as any),
  },
  {
    name: 'move_documents',
    description:
      'Move a document to another notebook/path. Content is preserved, but the location ' +
      'changes — mention it to the user so the move is not surprising.',
    inputSchema: {
      type: 'object',
      properties: {
        fromNotebook: { type: 'string', description: 'Source notebook ID' },
        fromPath: { type: 'string', description: 'Source document path' },
        toNotebook: { type: 'string', description: 'Target notebook ID' },
        toPath: { type: 'string', description: 'Target path' },
      },
      required: ['fromNotebook', 'fromPath', 'toNotebook', 'toPath'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => moveDocuments(client, args as any),
  },
  {
    name: 'upload_asset',
    description:
      'Upload small assets into the workspace. Binary transfers are impractical over MCP, ' +
      'so `data` should be text or a base64 string — use it for small text/icon assets; ' +
      'put large files into the workspace assets directory directly.',
    inputSchema: {
      type: 'object',
      properties: {
        assetsDirPath: { type: 'string', description: 'Asset directory, usually /assets/' },
        files: {
          type: 'array',
          description: 'Files to upload',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              data: { type: 'string', description: 'Text or base64 content' },
            },
            required: ['name', 'data'],
          },
        },
      },
      required: ['assetsDirPath', 'files'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => uploadAsset(client, args as any),
  },
  {
    name: 'insert_local_assets',
    description:
      'Insert assets that already exist on the **server filesystem** into a block. ' +
      '`assetPaths` must be ABSOLUTE paths (e.g. C:\\\\...\\\\data\\\\assets\\\\foo.png) — ' +
      'SiYuan-internal paths like "assets/foo.png" are rejected. If you only have the ' +
      'internal path, resolve_asset_path turns it into an absolute one first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Target block ID' },
        assetPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'ABSOLUTE filesystem paths of the assets to insert',
        },
      },
      required: ['id', 'assetPaths'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => insertLocalAssets(client, args as any),
  },
  {
    name: 'save_as_template',
    description: 'Save a document as a template. Additive — the source document is unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Source document ID' },
        name: { type: 'string', description: 'Template name' },
      },
      required: ['id', 'name'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => saveAsTemplate(client, args as any),
  },
  {
    name: 'create_snapshot',
    description:
      'Create a local (or cloud) snapshot. Additive — nothing is overwritten. ' +
      'Note that **rolling back** to a snapshot is destructive and is not exposed.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional snapshot name' },
        cloud: { type: 'boolean', description: 'Create a cloud snapshot instead of a local one' },
      },
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => createSnapshot(client, args as any),
  },
  {
    name: 'rename_bookmark',
    description: 'Rename a bookmark.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Bookmark ID' },
        name: { type: 'string', description: 'New bookmark name' },
      },
      required: ['id', 'name'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => renameBookmark(client, args as any),
  },
  {
    name: 'transfer_block_ref',
    description:
      'Transfer a block reference from one block to another. Changes where references point; ' +
      'content is not destroyed, but the reference graph changes — tell the user.',
    inputSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'Source block ID' },
        toId: { type: 'string', description: 'Target block ID' },
      },
      required: ['fromId', 'toId'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => transferBlockRef(client, args as any),
  },

  // ==================== 破坏性（覆盖既有值）====================
  {
    name: 'set_block_attrs',
    description:
      'Set attributes on a single block. Overwrites existing values of the same attribute ' +
      'keys — confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Block ID' },
        attrs: {
          type: 'object',
          description: 'Attribute map, e.g. {"custom-key": "value"}',
        },
      },
      required: ['id', 'attrs'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => setBlockAttrs(client, args as any),
  },
];
