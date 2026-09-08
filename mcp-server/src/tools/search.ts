/**
 * MCP Search Tools for SiYuan
 */

import type { SiYuanClient } from '../siyuan/api.js';
import type { SearchBlocksResponse, Block } from '../siyuan/types.js';

export interface SearchToolResult {
  blocks: Array<{
    id: string;
    type: string;
    content: string;
    path: string;
    notebook: string;
    created: string;
    updated: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Search notes by keyword
 */
export async function searchNotes(
  client: SiYuanClient,
  args: {
    query: string;
    notebooks?: string[];
    page?: number;
    pageSize?: number;
  }
): Promise<SearchToolResult> {
  const { query, notebooks, page = 1, pageSize = 20 } = args;

  const response: SearchBlocksResponse = await client.searchBlocks({
    query,
    boxes: notebooks || [],
    method: 0 as 0, // keyword search
    page,
    pageSize,
  });

  const blocks = (response.blocks || []).map((block) => ({
    id: block.id,
    type: getBlockTypeLabel(block.type),
    content: formatBlockContent(block.content),
    path: block.hpath || block.path,
    notebook: block.box,
    created: block.created,
    updated: block.updated,
  }));

  return {
    blocks,
    total: response.matchedBlockCount,
    page,
    pageSize,
  };
}

/**
 * Search blocks with advanced options
 */
export async function searchBlocks(
  client: SiYuanClient,
  args: {
    query: string;
    types?: string[];
    notebooks?: string[];
    paths?: string[];
    method?: 'keyword' | 'querySyntax' | 'sql' | 'regex';
    page?: number;
    pageSize?: number;
  }
): Promise<SearchToolResult> {
  const {
    query,
    types,
    notebooks,
    paths,
    method = 'keyword',
    page = 1,
    pageSize = 20,
  } = args;

  const methodMap = {
    keyword: 0,
    querySyntax: 1,
    sql: 2,
    regex: 3,
  };

  const typeFilter = types
    ? {
        document: types.includes('document'),
        heading: types.includes('heading'),
        paragraph: types.includes('paragraph'),
        list: types.includes('list'),
        listItem: types.includes('listItem'),
        codeBlock: types.includes('codeBlock'),
        mathBlock: types.includes('mathBlock'),
        table: types.includes('table'),
        blockquote: types.includes('blockquote'),
        superBlock: types.includes('superBlock'),
        htmlBlock: types.includes('htmlBlock'),
      }
    : undefined;

  const response: SearchBlocksResponse = await client.searchBlocks({
    query,
    types: typeFilter,
    boxes: notebooks,
    paths,
    method: methodMap[method] as 0 | 1 | 2 | 3,
    page,
    pageSize,
  });

  const blocks = response.blocks.map((block) => ({
    id: block.id,
    type: getBlockTypeLabel(block.type),
    content: formatBlockContent(block.content),
    path: block.hpath || block.path,
    notebook: block.box,
    created: block.created,
    updated: block.updated,
  }));

  return {
    blocks,
    total: response.matchedBlockCount,
    page,
    pageSize,
  };
}

/**
 * List all notebooks
 */
export async function listNotebooks(client: SiYuanClient): Promise<
  Array<{
    id: string;
    name: string;
    icon: string;
    closed: boolean;
  }>
> {
  const response = await client.listNotebooks();

  return response.notebooks.map((notebook) => ({
    id: notebook.id,
    name: notebook.name,
    icon: notebook.icon,
    closed: notebook.closed,
  }));
}

// ==================== Helper Functions ====================

/**
 * Get human-readable block type label
 */
function getBlockTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    d: 'document',
    h: 'heading',
    p: 'paragraph',
    l: 'list',
    i: 'listItem',
    c: 'codeBlock',
    m: 'mathBlock',
    t: 'table',
    b: 'blockquote',
    s: 'superBlock',
    html: 'htmlBlock',
    tb: 'thematicBreak',
    video: 'video',
    audio: 'audio',
    widget: 'widget',
    iframe: 'iframe',
  };

  return typeLabels[type] || type;
}

/**
 * Format block content for display
 * Remove HTML tags and limit length
 */
function formatBlockContent(content: string, maxLength: number = 200): string {
  // Remove HTML tags
  let text = content.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Limit length
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }

  return text;
}

/**
 * Format search results as readable text
 */
export function formatSearchResults(result: SearchToolResult): string {
  const lines: string[] = [];

  lines.push(`Found ${result.total} results (showing page ${result.page}):\n`);

  for (const block of result.blocks) {
    lines.push(`[${block.type}] ${block.path}`);
    lines.push(`  ID: ${block.id}`);
    lines.push(`  Content: ${block.content}`);
    lines.push(`  Updated: ${block.updated}`);
    lines.push('');
  }

  return lines.join('\n');
}
