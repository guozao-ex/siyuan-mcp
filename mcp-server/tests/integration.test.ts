/**
 * Integration tests for MCP server
 *
 * These tests require a running SiYuan instance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SiYuanClient } from '../src/siyuan/api';

// Skip integration tests in CI unless explicitly enabled
const skipIntegration = process.env.RUN_INTEGRATION_TESTS !== 'true';

describe.skipIf(skipIntegration)('SiYuan Integration Tests', () => {
  let client: SiYuanClient;

  beforeAll(async () => {
    // Use environment variables or defaults
    const apiUrl = process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';
    const apiToken = process.env.SIYUAN_API_TOKEN || '';

    client = new SiYuanClient(apiUrl, apiToken);

    // Verify connection
    const isConnected = await client.checkConnection();
    if (!isConnected) {
      throw new Error(
        'Cannot connect to SiYuan. Make sure SiYuan is running at ' + apiUrl
      );
    }
  });

  describe('System APIs', () => {
    it('should get SiYuan version', async () => {
      const version = await client.getVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should get boot progress', async () => {
      const progress = await client.getBootProgress();
      expect(progress).toBeDefined();
      expect(progress.progress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Notebook APIs', () => {
    it('should list notebooks', async () => {
      const result = await client.listNotebooks();
      expect(result.notebooks).toBeDefined();
      expect(Array.isArray(result.notebooks)).toBe(true);

      if (result.notebooks.length > 0) {
        const notebook = result.notebooks[0];
        expect(notebook).toHaveProperty('id');
        expect(notebook).toHaveProperty('name');
        expect(notebook).toHaveProperty('icon');
      }
    });
  });

  describe('Search APIs', () => {
    it('should search blocks', async () => {
      const result = await client.searchBlocks({
        query: 'test',
        method: 0,
        pageSize: 5,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('matchedBlockCount');
      expect(Array.isArray(result.blocks)).toBe(true);
    });

    it('should handle empty search results', async () => {
      const result = await client.searchBlocks({
        query: 'xyzabcnonexistentquery12345',
        method: 0,
      });

      expect(result.blocks).toHaveLength(0);
      expect(result.matchedBlockCount).toBe(0);
    });
  });

  describe('Block APIs', () => {
    let testBlockId: string | null = null;

    beforeAll(async () => {
      // Find any block to test with
      const searchResult = await client.searchBlocks({
        query: '',
        method: 0,
        pageSize: 1,
      });

      if (searchResult.blocks.length > 0) {
        testBlockId = searchResult.blocks[0].id;
      }
    });

    it('should get block kramdown', async () => {
      if (!testBlockId) {
        console.warn('No test block available, skipping');
        return;
      }

      const result = await client.getBlockKramdown(testBlockId);
      expect(result).toBeDefined();
      expect(result.id).toBe(testBlockId);
      expect(result.kramdown).toBeDefined();
    });

    it('should get block attributes', async () => {
      if (!testBlockId) {
        console.warn('No test block available, skipping');
        return;
      }

      const result = await client.getBlockAttrs(testBlockId);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('SQL APIs', () => {
    it('should execute SQL query', async () => {
      const result = await client.sql('SELECT * FROM blocks LIMIT 5');
      expect(result).toBeDefined();
      expect(result.columns).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should handle SQL errors', async () => {
      await expect(client.sql('INVALID SQL QUERY')).rejects.toThrow();
    });
  });

  describe('Caching', () => {
    it('should cache notebook list', async () => {
      // First call
      const start1 = Date.now();
      const result1 = await client.listNotebooks();
      const duration1 = Date.now() - start1;

      // Second call should be faster (cached)
      const start2 = Date.now();
      const result2 = await client.listNotebooks();
      const duration2 = Date.now() - start2;

      expect(result1.notebooks.length).toBe(result2.notebooks.length);
      expect(duration2).toBeLessThan(duration1 / 2); // At least 2x faster
    });
  });
});
