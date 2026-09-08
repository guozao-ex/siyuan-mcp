#!/usr/bin/env node

/**
 * SiYuan MCP Server
 *
 * Provides MCP (Model Context Protocol) tools for interacting with SiYuan Note.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createClient, SiYuanClient } from './siyuan/api.js';
import { searchNotes, searchBlocks, listNotebooks } from './tools/search.js';
import { readBlock, readDocument, readByPath } from './tools/read.js';
import {
  createDocument,
  updateBlock,
  appendBlock,
  insertBlockAfter,
  deleteBlock,
  renameDocument,
  deleteDocument,
  appendToDocument,
} from './tools/write.js';

// Initialize SiYuan client
const siyuanClient: SiYuanClient = createClient();

// Create MCP server
const server = new Server(
  {
    name: 'siyuan-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ==================== Tool Definitions ====================

const TOOLS = [
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
  },
  {
    name: 'list_notebooks',
    description: 'List all notebooks in SiYuan',
    inputSchema: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'update_block',
    description: 'Update an existing block content',
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
  },
  {
    name: 'delete_block',
    description: 'Delete a block by ID',
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
  },
];

// ==================== Request Handlers ====================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_notes': {
        const result = await searchNotes(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_notebooks': {
        const result = await listNotebooks(siyuanClient);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'read_block': {
        const result = await readBlock(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'read_document': {
        const result = await readDocument(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_document': {
        const result = await createDocument(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_block': {
        const result = await updateBlock(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'append_block': {
        const result = await appendBlock(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete_block': {
        const result = await deleteBlock(siyuanClient, args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: errorMessage,
              tool: name,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ==================== Server Startup ====================

async function main() {
  // Check connection to SiYuan
  console.error('Checking connection to SiYuan...');
  const status = await siyuanClient.getConnectionStatus();

  if (!status.connected) {
    console.error('Failed to connect to SiYuan:', status.error);
    console.error('Please ensure:');
    console.error('1. SiYuan is running');
    console.error('2. SIYUAN_API_URL is set correctly (default: http://127.0.0.1:6806)');
    console.error('3. SIYUAN_API_TOKEN is set if required');
    process.exit(1);
  }

  console.error(`Connected to SiYuan version ${status.version}`);
  console.error('Starting MCP server...');

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('SiYuan MCP server running on stdio');
}

// Start server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
