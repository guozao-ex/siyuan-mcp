/**
 * MCP Read Tools for SiYuan
 */

import type { SiYuanClient } from '../siyuan/api.js';
import { findBlockRow, INDEX_HINT } from '../core/block-index.js';

export interface ReadBlockResult {
  id: string;
  content: string;
  markdown: string;
  attributes?: Record<string, string>;
}

export interface ReadDocumentResult {
  id: string;
  name: string;
  content: string;
  markdown: string;
  refCount: number;
  subFileCount: number;
  created: string;
  updated: string;
}

/**
 * Read a single block by ID
 */
export async function readBlock(
  client: SiYuanClient,
  args: {
    id: string;
    includeAttributes?: boolean;
  }
): Promise<ReadBlockResult> {
  const { id, includeAttributes = false } = args;

  // 先确认块在索引里存在（带短暂重试），再取内容 ——
  // 顺序很关键：getBlockKramdown 对不存在的块会直接抛错，
  // 若先调它，就失去了重试的机会。
  const block = await findBlockRow(client, id);

  if (!block) {
    throw new Error(`Block not found: ${id}${INDEX_HINT}`);
  }

  // Get block kramdown (markdown)
  const kramdownResponse = await client.getBlockKramdown(id);

  const result: ReadBlockResult = {
    id: block.id,
    content: block.content || '',
    markdown: kramdownResponse.kramdown || '',
  };

  // Optionally include attributes
  if (includeAttributes) {
    const attrs = await client.getBlockAttrs(id);
    result.attributes = attrs;
  }

  return result;
}

/**
 * Read a document (note) by ID
 *
 * 实现要点（曾经写错，导致内容重复 + N+1 次请求）：
 * `getBlockKramdown(docId)` 对**文档**返回的是整篇 kramdown，其中已经包含
 * 所有子块的正文。因此 `includeChildren: true` 时直接采用它即可 ——
 * 旧实现还会再对每个子块各调一次 `getBlockKramdown` 并追加到末尾，
 * 结果是正文在输出里出现两遍，且大文档会产生成百上千次请求。
 */
export async function readDocument(
  client: SiYuanClient,
  args: {
    id: string;
    includeChildren?: boolean;
  }
): Promise<ReadDocumentResult> {
  const { id, includeChildren = true } = args;

  // Get document info
  const docInfo = await client.getDocInfo(id);

  // 查文档根块（带索引等待重试，理由见 findBlockRow）
  const block = await findBlockRow(client, id);

  if (!block) {
    throw new Error(`Document not found: ${id}${INDEX_HINT}`);
  }

  let fullMarkdown: string;

  if (includeChildren) {
    // 文档的 kramdown 已含全部子块正文
    const kramdownResponse = await client.getBlockKramdown(id);
    fullMarkdown = kramdownResponse.kramdown || '';
  } else {
    // 只要文档根块自身（通常就是标题那一段）
    fullMarkdown = block.content || '';
  }

  return {
    id: block.id,
    name: docInfo.name,
    content: block.content || '',
    markdown: fullMarkdown,
    refCount: docInfo.refCount,
    subFileCount: docInfo.subFileCount,
    created: block.created,
    updated: block.updated,
  };
}

/**
 * Read multiple blocks by IDs
 */
export async function readBlocks(
  client: SiYuanClient,
  args: {
    ids: string[];
    includeAttributes?: boolean;
  }
): Promise<ReadBlockResult[]> {
  const { ids, includeAttributes = false } = args;

  const results: ReadBlockResult[] = [];

  for (const id of ids) {
    try {
      const result = await readBlock(client, { id, includeAttributes });
      results.push(result);
    } catch (error) {
      console.warn(`Failed to read block ${id}:`, error);
      // Continue with other blocks
    }
  }

  return results;
}

/**
 * Get block content by path (human-readable path)
 */
export async function readByPath(
  client: SiYuanClient,
  args: {
    path: string;
    notebook?: string;
  }
): Promise<ReadBlockResult[]> {
  const { path, notebook } = args;

  // Search blocks by path
  const searchResponse = await client.searchBlocks({
    query: path,
    boxes: notebook ? [notebook] : undefined,
    method: 0, // keyword search
    pageSize: 10,
  });

  if (!searchResponse.blocks || searchResponse.blocks.length === 0) {
    throw new Error(`No blocks found for path: ${path}`);
  }

  // Filter blocks that match the path
  const matchingBlocks = searchResponse.blocks.filter(
    (block) => block.hpath.includes(path) || block.path.includes(path)
  );

  if (matchingBlocks.length === 0) {
    throw new Error(`No blocks found for path: ${path}`);
  }

  // Read all matching blocks
  const results: ReadBlockResult[] = [];

  for (const block of matchingBlocks) {
    try {
      const result = await readBlock(client, { id: block.id });
      results.push(result);
    } catch (error) {
      console.warn(`Failed to read block ${block.id}:`, error);
    }
  }

  return results;
}

// ==================== Helper Functions ====================

/**
 * Format read result as readable text
 */
export function formatReadResult(result: ReadBlockResult | ReadDocumentResult): string {
  const lines: string[] = [];

  if ('name' in result) {
    // Document result
    lines.push(`Document: ${result.name}`);
    lines.push(`ID: ${result.id}`);
    lines.push(`Created: ${result.created}`);
    lines.push(`Updated: ${result.updated}`);
    lines.push(`References: ${result.refCount}`);
    lines.push(`Sub-files: ${result.subFileCount}`);
  } else {
    // Block result
    lines.push(`Block ID: ${result.id}`);
  }

  if ('attributes' in result && result.attributes) {
    lines.push('\nAttributes:');
    for (const [key, value] of Object.entries(result.attributes)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  lines.push('\nMarkdown Content:');
  lines.push('---');
  lines.push(result.markdown);
  lines.push('---');

  return lines.join('\n');
}

/**
 * Extract plain text from markdown
 */
export function extractPlainText(markdown: string): string {
  // Remove code blocks
  let text = markdown.replace(/```[\s\S]*?```/g, '[code block]');

  // Remove inline code
  text = text.replace(/`[^`]+`/g, '');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '[image: $1]');

  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Remove headings markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic
  text = text.replace(/\*\*([^\*]+)\*\*/g, '$1');
  text = text.replace(/\*([^\*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // Remove extra whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}
