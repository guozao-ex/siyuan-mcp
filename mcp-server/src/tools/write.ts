/**
 * MCP Write Tools for SiYuan
 */

import type { SiYuanClient } from '../siyuan/api.js';
import { findBlockRow, INDEX_HINT } from '../core/block-index.js';

export interface CreateDocumentResult {
  id: string;
  path: string;
  message: string;
}

export interface UpdateBlockResult {
  id: string;
  message: string;
}

export interface AppendBlockResult {
  id: string;
  parentId: string;
  message: string;
}

export interface DeleteBlockResult {
  id: string;
  message: string;
}

/**
 * 等待新文档进入思源的 SQL 索引。
 *
 * 思源的 blocks 索引是**异步**构建的：实测新建文档后约 1.0~1.2 秒才出现在
 * blocks 表里，这段时间内 read_document / search_notes 都查不到该文档
 * （read_document 会直接报 "Document not found"）。
 *
 * 为了让「创建成功」真正意味着「立即可读」，这里做一次短暂轮询。
 *
 * @returns 是否在超时前确认可读；false 表示文档已创建但索引未及时就绪
 */
async function waitForDocumentIndexed(
  client: SiYuanClient,
  id: string,
  timeoutMs = 5000
): Promise<boolean> {
  // 思源块 ID 形如 20240101120000-abcdefg；这里仍做一次转义，避免拼接进 SQL 时出问题
  const safeId = id.replace(/'/g, "''");
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const rows = await client.sql(`SELECT id FROM blocks WHERE id = '${safeId}' LIMIT 1`);
      if (rows && rows.length > 0) return true;
    } catch {
      // 索引尚未就绪时查询可能失败，继续重试
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Create a new document
 */
export async function createDocument(
  client: SiYuanClient,
  args: {
    notebook: string;
    path: string;
    title: string;
    content?: string;
  }
): Promise<CreateDocumentResult> {
  const { notebook, path, title, content = '' } = args;

  // Construct markdown with title
  const markdown = `# ${title}\n\n${content}`;

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Create document
  const docId = await client.createDocWithMd(notebook, normalizedPath, markdown);

  // 等索引就绪，让调用方（通常是 AI Agent）拿到 ID 后可以立刻读取
  const indexed = await waitForDocumentIndexed(client, docId);

  return {
    id: docId,
    path: normalizedPath,
    message: indexed
      ? `Document created successfully: ${title}`
      : `Document created successfully: ${title}` +
        '（思源索引尚未就绪，立刻读取可能暂时查不到，稍等片刻即可）',
  };
}

/**
 * Update an existing block
 */
export async function updateBlock(
  client: SiYuanClient,
  args: {
    id: string;
    content: string;
    dataType?: 'markdown' | 'dom';
  }
): Promise<UpdateBlockResult> {
  const { id, content, dataType = 'markdown' } = args;

  // Update block
  await client.updateBlock({
    id,
    dataType,
    data: content,
  });

  return {
    id,
    message: `Block ${id} updated successfully`,
  };
}

/**
 * Append content to a block (add as child)
 */
export async function appendBlock(
  client: SiYuanClient,
  args: {
    parentId: string;
    content: string;
    dataType?: 'markdown' | 'dom';
  }
): Promise<AppendBlockResult> {
  const { parentId, content, dataType = 'markdown' } = args;

  // Append block
  const response = await client.appendBlock(parentId, content);

  // Extract the new block ID from response
  const newBlockId = response[0]?.doOperations?.[0]?.id || 'unknown';

  return {
    id: newBlockId,
    parentId,
    message: `Content appended to block ${parentId}`,
  };
}

/**
 * Insert content before a block
 */
export async function insertBlockBefore(
  client: SiYuanClient,
  args: {
    nextId: string;
    content: string;
    dataType?: 'markdown' | 'dom';
  }
): Promise<AppendBlockResult> {
  const { nextId, content, dataType = 'markdown' } = args;

  // 查锚点块的父块。必须用 findBlockRow 而不是直接 SQL：
  // 刚插入的块可能还没进 blocks 索引，直接查会误报 "Block not found"。
  const anchor = await findBlockRow(client, nextId);
  if (!anchor) {
    throw new Error(`Block not found: ${nextId}${INDEX_HINT}`);
  }

  const parentId = anchor.parent_id;

  // Insert block
  const response = await client.insertBlock({
    dataType,
    data: content,
    nextID: nextId,
  });

  const newBlockId = response[0]?.doOperations?.[0]?.id || 'unknown';

  return {
    id: newBlockId,
    parentId,
    message: `Content inserted before block ${nextId}`,
  };
}

/**
 * Insert content after a block
 */
export async function insertBlockAfter(
  client: SiYuanClient,
  args: {
    previousId: string;
    content: string;
    dataType?: 'markdown' | 'dom';
  }
): Promise<AppendBlockResult> {
  const { previousId, content, dataType = 'markdown' } = args;

  // 同上：锚点块可能刚插入，索引未就绪，必须带等待重试
  const anchor = await findBlockRow(client, previousId);
  if (!anchor) {
    throw new Error(`Block not found: ${previousId}${INDEX_HINT}`);
  }

  const parentId = anchor.parent_id;

  // Insert block
  const response = await client.insertBlock({
    dataType,
    data: content,
    previousID: previousId,
  });

  const newBlockId = response[0]?.doOperations?.[0]?.id || 'unknown';

  return {
    id: newBlockId,
    parentId,
    message: `Content inserted after block ${previousId}`,
  };
}

/**
 * Delete a block
 */
export async function deleteBlock(
  client: SiYuanClient,
  args: {
    id: string;
  }
): Promise<DeleteBlockResult> {
  const { id } = args;

  // Delete block
  await client.deleteBlock(id);

  return {
    id,
    message: `Block ${id} deleted successfully`,
  };
}

/**
 * Rename a document
 *
 * 注意：思源的 `/api/filetree/renameDoc` 返回 `data: null`，
 * 所以这里**不能**去读返回值（曾因此抛 "Cannot read properties of null"）。
 * 用调用方给的 id（若没有则退回 path）作为结果标识。
 */
export async function renameDocument(
  client: SiYuanClient,
  args: {
    notebook: string;
    path: string;
    newTitle: string;
    /** 可选：文档 id，仅用于回填返回值 */
    id?: string;
  }
): Promise<{ id: string; message: string }> {
  const { notebook, path, newTitle, id } = args;

  await client.renameDoc(notebook, path, newTitle);

  return {
    id: id ?? path,
    message: `Document renamed to: ${newTitle}`,
  };
}

/**
 * Delete a document
 *
 * 同上：`/api/filetree/removeDoc` 也返回 `data: null`。
 */
export async function deleteDocument(
  client: SiYuanClient,
  args: {
    notebook: string;
    path: string;
    /** 可选：文档 id，仅用于回填返回值 */
    id?: string;
  }
): Promise<{ id: string; message: string }> {
  const { notebook, path, id } = args;

  await client.removeDoc(notebook, path);

  return {
    id: id ?? path,
    message: `Document deleted: ${path}`,
  };
}

/**
 * Append content to document (add to the end)
 */
export async function appendToDocument(
  client: SiYuanClient,
  args: {
    documentId: string;
    content: string;
  }
): Promise<AppendBlockResult> {
  const { documentId, content } = args;

  // Append to document root
  return appendBlock(client, {
    parentId: documentId,
    content,
  });
}

// ==================== Helper Functions ====================

/**
 * Validate notebook exists
 */
export async function validateNotebook(
  client: SiYuanClient,
  notebookId: string
): Promise<boolean> {
  const notebooks = await client.listNotebooks();
  return notebooks.notebooks.some((nb) => nb.id === notebookId);
}

/**
 * Validate block exists
 */
export async function validateBlock(
  client: SiYuanClient,
  blockId: string
): Promise<boolean> {
  try {
    const result = await client.sql(`SELECT id FROM blocks WHERE id = '${blockId}.`);
    return result && result.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Format write result as readable text
 */
export function formatWriteResult(
  result:
    | CreateDocumentResult
    | UpdateBlockResult
    | AppendBlockResult
    | DeleteBlockResult
): string {
  const lines: string[] = [];

  lines.push('Operation completed successfully:');
  lines.push(`  ${result.message}`);
  lines.push(`  ID: ${result.id}`);

  if ('path' in result) {
    lines.push(`  Path: ${result.path}`);
  }

  if ('parentId' in result) {
    lines.push(`  Parent ID: ${result.parentId}`);
  }

  return lines.join('\n');
}

/**
 * Sanitize markdown content
 * Remove potentially harmful content
 */
export function sanitizeMarkdown(markdown: string): string {
  // Remove script tags
  let sanitized = markdown.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  return sanitized;
}

/**
 * Validate markdown format
 */
export function validateMarkdown(markdown: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if content is too large (> 1MB)
  if (markdown.length > 1024 * 1024) {
    errors.push('Content is too large (max 1MB)');
  }

  // Check for suspicious patterns
  if (/<script/i.test(markdown)) {
    errors.push('Content contains script tags');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 在父块的**开头**插入内容（append_block 的反向操作）。
 * 只新增，不覆盖既有内容。
 */
export async function prependBlock(
  client: SiYuanClient,
  args: {
    parentId: string;
    content: string;
    dataType?: 'markdown' | 'dom';
  }
): Promise<AppendBlockResult> {
  const { parentId, content, dataType = 'markdown' } = args;

  // 思源返回数组：新块 ID 在 [0].doOperations[0].id
  const response = await client.prependBlock(parentId, content);
  const newBlockId = response[0]?.doOperations?.[0]?.id || 'unknown';

  return {
    id: newBlockId,
    parentId,
    message: `Content prepended to ${parentId}`,
  };
}

/**
 * 设置**单个**块的属性。
 *
 * 注意：会覆盖同名属性的既有值（与 batch_set_attrs 行为一致），
 * 因此 registry 里标为 destructiveHint: true。
 */
export async function setBlockAttrs(
  client: SiYuanClient,
  args: { id: string; attrs: Record<string, string> }
): Promise<{ id: string; attrs: Record<string, string>; message: string }> {
  const { id, attrs } = args;

  // 签名是两个参数：setBlockAttrs(id, attrs)
  await client.setBlockAttrs(id, attrs);

  return {
    id,
    attrs,
    message: `Attributes set on block ${id}`,
  };
}