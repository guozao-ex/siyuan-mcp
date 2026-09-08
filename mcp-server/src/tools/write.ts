/**
 * MCP Write Tools for SiYuan
 */

import type { SiYuanClient } from '../siyuan/api.js';

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

  return {
    id: docId,
    path: normalizedPath,
    message: `Document created successfully: ${title}`,
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
  const newBlockId = response.doOperations?.[0]?.id || 'unknown';

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

  // Get the parent of the next block
  const sqlResponse = await client.sql(
    `SELECT parent_id FROM blocks WHERE id = '${nextId}'`
  );

  if (!sqlResponse || sqlResponse.length === 0) {
    throw new Error(`Block not found: ${nextId}`);
  }

  const parentId = sqlResponse[0].parent_id;

  // Insert block
  const response = await client.insertBlock({
    dataType,
    data: content,
    nextID: nextId,
  });

  const newBlockId = response.doOperations?.[0]?.id || 'unknown';

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

  // Get the parent of the previous block
  const sqlResponse = await client.sql(
    `SELECT parent_id FROM blocks WHERE id = '${previousId}'`
  );

  if (!sqlResponse || sqlResponse.length === 0) {
    throw new Error(`Block not found: ${previousId}`);
  }

  const parentId = sqlResponse[0].parent_id;

  // Insert block
  const response = await client.insertBlock({
    dataType,
    data: content,
    previousID: previousId,
  });

  const newBlockId = response.doOperations?.[0]?.id || 'unknown';

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
 */
export async function renameDocument(
  client: SiYuanClient,
  args: {
    notebook: string;
    path: string;
    newTitle: string;
  }
): Promise<{ id: string; message: string }> {
  const { notebook, path, newTitle } = args;

  // Rename document
  const response = await client.renameDoc(notebook, path, newTitle);

  return {
    id: response.id,
    message: `Document renamed to: ${newTitle}`,
  };
}

/**
 * Delete a document
 */
export async function deleteDocument(
  client: SiYuanClient,
  args: {
    notebook: string;
    path: string;
  }
): Promise<{ id: string; message: string }> {
  const { notebook, path } = args;

  // Remove document
  const response = await client.removeDoc(notebook, path);

  return {
    id: response.id,
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
    const result = await client.sql(`SELECT id FROM blocks WHERE id = '${blockId}'`);
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
