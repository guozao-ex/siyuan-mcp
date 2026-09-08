/**
 * MCP Read Tools for SiYuan
 */

import type { SiYuanClient } from '../siyuan/api.js';

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

  // Get block kramdown (markdown)
  const kramdownResponse = await client.getBlockKramdown(id);

  // Get block info from SQL
  const sqlResponse = await client.sql(
    `SELECT * FROM blocks WHERE id = '${id}'`
  );

  if (!sqlResponse.rows || sqlResponse.rows.length === 0) {
    throw new Error(`Block not found: ${id}`);
  }

  const block = sqlResponse.rows[0];

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

  // Get document block content
  const kramdownResponse = await client.getBlockKramdown(id);

  // Get block metadata
  const sqlResponse = await client.sql(
    `SELECT * FROM blocks WHERE id = '${id}'`
  );

  if (!sqlResponse.rows || sqlResponse.rows.length === 0) {
    throw new Error(`Document not found: ${id}`);
  }

  const block = sqlResponse.rows[0];

  let fullMarkdown = kramdownResponse.kramdown || '';

  // If includeChildren, get all child blocks
  if (includeChildren) {
    const children = await client.sql(
      `SELECT * FROM blocks WHERE root_id = '${id}' AND id != '${id}' ORDER BY sort`
    );

    if (children.rows && children.rows.length > 0) {
      const childMarkdowns: string[] = [];

      for (const child of children.rows) {
        try {
          const childKramdown = await client.getBlockKramdown(child.id);
          if (childKramdown.kramdown) {
            childMarkdowns.push(childKramdown.kramdown);
          }
        } catch (error) {
          console.warn(`Failed to get kramdown for block ${child.id}:`, error);
        }
      }

      if (childMarkdowns.length > 0) {
        fullMarkdown = fullMarkdown + '\n\n' + childMarkdowns.join('\n\n');
      }
    }
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

  if (result.attributes) {
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
