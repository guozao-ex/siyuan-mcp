/**
 * 高危工具的注册表 —— 与 registry-extra.ts 分开，让"危险能力"集中可见。
 *
 * 这些工具是项目作者**逐项明确授权**后才加入的（默认不暴露）。
 * 每一项的 description 首行都写明 ASK THE USER FIRST。
 */
import type { ToolDefinition } from './registry.js';
import {
  deleteNotebook,
  deleteUnusedAssets,
  deleteSnapshot,
  rollbackSnapshot,
  rollbackDocHistory,
  clearWorkspaceHistory,
  importMarkdown,
  importSiyuanArchive,
  importData,
  importNotebook,
  exportPdf,
  exportDocx,
  exportHtml,
  exportMarkdownBatch,
  exportResources,
  triggerSync,
  getConfig,
  pushMessage,
} from './dangerous.js';

/** 高危工具统一的描述前缀 */
const WARN = '⚠️ DESTRUCTIVE — ASK THE USER FIRST: ';

export const DANGEROUS_TOOL_DEFINITIONS: ToolDefinition[] = [
  // ==================== 删除类 ====================
  {
    name: 'delete_notebook',
    description:
      WARN +
      'deletes a whole notebook **including every document inside it**. ' +
      'This is the most dangerous tool here — make sure the user understands the scope. ' +
      'Prefer delete_document when only one note should go.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID to delete' },
      },
      required: ['notebook'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => deleteNotebook(client, args as any),
  },
  {
    name: 'delete_unused_assets',
    description:
      WARN +
      'permanently deletes asset files **from disk**. Call list_unused_assets first and ' +
      'show the user the exact list before deleting.',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Asset paths to delete, e.g. ["assets/foo.png"]',
        },
      },
      required: ['paths'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => deleteUnusedAssets(client, args as any),
  },
  {
    name: 'delete_snapshot',
    description: WARN + 'deletes snapshot(s); deleted snapshots can no longer be restored.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Snapshot IDs to delete',
        },
      },
      required: ['ids'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => deleteSnapshot(client, args as any),
  },

  // ==================== 回滚类 ====================
  {
    name: 'rollback_snapshot',
    description:
      WARN +
      'rolls the workspace back to a snapshot, **overwriting the current content**. ' +
      'Anything created after that snapshot may be lost. Confirm the snapshot ID with the user.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Snapshot ID to roll back to' },
      },
      required: ['id'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => rollbackSnapshot(client, args as any),
  },
  {
    name: 'rollback_doc_history',
    description:
      WARN +
      'rolls a document back to a history version, **overwriting its current content**. ' +
      'Use get_history first to let the user pick the version.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
        path: { type: 'string', description: 'Document path' },
        historyPath: { type: 'string', description: 'History entry to restore (from get_history)' },
      },
      required: ['notebook', 'path', 'historyPath'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => rollbackDocHistory(client, args as any),
  },
  {
    name: 'clear_workspace_history',
    description:
      WARN +
      'clears ALL workspace history. After this, past versions can never be restored. ' +
      'There is no undo.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { destructiveHint: true },
    handler: (client, args) => clearWorkspaceHistory(client, args as any),
  },

  // ==================== 导入类 ====================
  {
    name: 'import_markdown',
    description:
      WARN +
      'imports a Markdown folder from the **server-side filesystem** into a notebook. ' +
      'Documents with the same name at the target path may be overwritten. ' +
      'Confirm the local path and target with the user.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Target notebook ID' },
        localPath: { type: 'string', description: 'Absolute path on the server filesystem' },
        toPath: { type: 'string', description: 'Target path inside the notebook' },
      },
      required: ['notebook', 'localPath', 'toPath'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => importMarkdown(client, args as any),
  },
  {
    name: 'import_siyuan_archive',
    description:
      WARN + 'imports a .sy archive from the server-side filesystem. It may overwrite data.',
    inputSchema: {
      type: 'object',
      properties: {
        localPath: { type: 'string', description: 'Absolute path to the .sy file' },
      },
      required: ['localPath'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => importSiyuanArchive(client, args as any),
  },
  {
    name: 'import_data',
    description:
      WARN +
      'imports data from the server-side filesystem. Documents with the same name at the ' +
      'target path may be overwritten.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Target notebook ID' },
        localPath: { type: 'string', description: 'Absolute path on the server filesystem' },
        toPath: { type: 'string', description: 'Target path inside the notebook' },
      },
      required: ['notebook', 'localPath', 'toPath'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => importData(client, args as any),
  },
  {
    name: 'import_notebook',
    description: WARN + 'imports a notebook from the server-side filesystem.',
    inputSchema: {
      type: 'object',
      properties: {
        localPath: { type: 'string', description: 'Absolute path on the server filesystem' },
      },
      required: ['localPath'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => importNotebook(client, args as any),
  },

  // ==================== 导出类（不修改笔记，但会写文件且可能很慢）====================
  {
    name: 'export_pdf',
    description:
      'Export a document as PDF. Non-destructive (note content is untouched) but it ' +
      '**writes a file into the workspace** and can take a while. The user first, please.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
        savePath: { type: 'string', description: 'Optional output path' },
      },
      required: ['id'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => exportPdf(client, args as any),
  },
  {
    name: 'export_docx',
    description:
      'Export a document as DOCX. Non-destructive but **writes a file into the workspace**.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
        savePath: { type: 'string', description: 'Optional output path' },
      },
      required: ['id'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => exportDocx(client, args as any),
  },
  {
    name: 'export_html',
    description:
      'Export a document as HTML (optionally PDF). Non-destructive but writes files.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
        pdf: { type: 'boolean', description: 'Also produce a PDF' },
        savePath: { type: 'string', description: 'Optional output path' },
      },
      required: ['id'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => exportHtml(client, args as any),
  },
  {
    name: 'export_markdown_batch',
    description:
      'Export an entire notebook folder as Markdown. Non-destructive but **heavy** — ' +
      'it can write a large number of files. Confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook: { type: 'string', description: 'Notebook ID' },
        path: { type: 'string', description: 'Path inside the notebook to export' },
      },
      required: ['notebook', 'path'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => exportMarkdownBatch(client, args as any),
  },
  {
    name: 'export_resources',
    description: 'Export assets as a .zip archive into the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Asset path or directory to export' },
      },
      required: ['path'],
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => exportResources(client, args as any),
  },

  // ==================== 系统类 ====================
  {
    name: 'trigger_sync',
    description:
      WARN +
      'starts a cloud sync. This exchanges data with the cloud and can change local or ' +
      'remote state — ask the user before triggering it.',
    inputSchema: {
      type: 'object',
      properties: {
        mobileSwitch: { type: 'boolean', description: 'Optional mobile-switch flag' },
      },
    },
    annotations: { destructiveHint: true },
    handler: (client, args) => triggerSync(client, args as any),
  },
  {
    name: 'get_config',
    description:
      'Read the SiYuan workspace configuration. Read-only, but the config may contain ' +
      'secrets — sensitive fields (token / apikey / secret / password) are automatically ' +
      'redacted before being returned.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    handler: (client, args) => getConfig(client, args as any),
  },

  // ==================== 通知类 ====================
  {
    name: 'push_message',
    description:
      'Show a message toast inside the SiYuan UI. Harmless — it touches nothing but the ' +
      'interface. Handy to tell the user what the agent just did.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to show' },
        timeout: { type: 'number', description: 'Auto-dismiss after N ms' },
        error: { type: 'boolean', description: 'Show as an error toast' },
      },
      required: ['message'],
    },
    annotations: { destructiveHint: false },
    handler: (client, args) => pushMessage(client, args as any),
  },
];
