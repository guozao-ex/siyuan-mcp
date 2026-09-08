/**
 * MCP Client API for SiYuan Plugin
 */

export interface McpClientConfig {
  serverUrl: string;
  timeout?: number;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface McpToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export class McpClient {
  private serverUrl: string;
  private timeout: number;

  constructor(config: McpClientConfig) {
    this.serverUrl = config.serverUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
  }

  /**
   * Call MCP tool
   */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          arguments: args,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: McpToolResult = await response.json();

      if (result.isError) {
        const errorText = result.content[0]?.text || 'Unknown error';
        throw new Error(errorText);
      }

      // Parse result text as JSON
      const resultText = result.content[0]?.text || '{}';
      return JSON.parse(resultText);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
  }

  /**
   * Search notes
   */
  async searchNotes(query: string, options?: {
    notebooks?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    return this.callTool('search_notes', {
      query,
      ...options,
    });
  }

  /**
   * List notebooks
   */
  async listNotebooks(): Promise<any> {
    return this.callTool('list_notebooks', {});
  }

  /**
   * Read block by ID
   */
  async readBlock(id: string, includeAttributes?: boolean): Promise<any> {
    return this.callTool('read_block', {
      id,
      includeAttributes,
    });
  }

  /**
   * Read document by ID
   */
  async readDocument(id: string, includeChildren?: boolean): Promise<any> {
    return this.callTool('read_document', {
      id,
      includeChildren,
    });
  }

  /**
   * Create document
   */
  async createDocument(
    notebook: string,
    path: string,
    title: string,
    content?: string
  ): Promise<any> {
    return this.callTool('create_document', {
      notebook,
      path,
      title,
      content,
    });
  }

  /**
   * Update block
   */
  async updateBlock(id: string, content: string): Promise<any> {
    return this.callTool('update_block', {
      id,
      content,
    });
  }

  /**
   * Append block
   */
  async appendBlock(parentId: string, content: string): Promise<any> {
    return this.callTool('append_block', {
      parentId,
      content,
    });
  }

  /**
   * Delete block
   */
  async deleteBlock(id: string): Promise<any> {
    return this.callTool('delete_block', {
      id,
    });
  }

  /**
   * Check if MCP server is reachable
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create MCP client instance
 */
export function createMcpClient(config: McpClientConfig): McpClient {
  return new McpClient(config);
}
