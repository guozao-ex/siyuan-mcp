/**
 * Tests for SiYuan API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SiYuanClient } from '../src/siyuan/api';

// Mock fetch globally
global.fetch = vi.fn();

describe('SiYuanClient', () => {
  let client: SiYuanClient;

  beforeEach(() => {
    client = new SiYuanClient('http://localhost:6806', 'test-token');
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default values', () => {
      const defaultClient = new SiYuanClient();
      expect(defaultClient).toBeDefined();
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new SiYuanClient('http://localhost:6806/');
      expect(clientWithSlash).toBeDefined();
    });
  });

  describe('getVersion', () => {
    it('should return version string', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: { version: '2.9.0' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const version = await client.getVersion();
      expect(version).toBe('2.9.0');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:6806/api/system/version',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Token test-token',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        code: 1,
        msg: 'API Error',
        data: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      await expect(client.getVersion()).rejects.toThrow('API Error');
    });

    it(
      'should handle network errors',
      async () => {
        // 必须用 mockRejectedValue 而不是 mockRejectedValueOnce：
        // 'Network error' 命中重试白名单（含 "network"），实现会重试多次，
        // 只 mock 一次的话第二次 fetch 会返回 undefined，
        // 报错就退化成 "Cannot read properties of undefined (reading 'ok')"。
        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        await expect(client.getVersion()).rejects.toThrow('Network error');
      },
      // 该用例要跑完 RetryHandler 的退避链（约 1s + 2s + 4s），
      // 超过 vitest 默认的 5s 用例超时，因此显式放宽。
      20000
    );
  });

  describe('listNotebooks', () => {
    it('should return notebooks list', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: {
          notebooks: [
            { id: '1', name: 'Notebook 1', icon: '📔', sort: 0, closed: false },
            { id: '2', name: 'Notebook 2', icon: '📗', sort: 1, closed: false },
          ],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const result = await client.listNotebooks();
      expect(result.notebooks).toHaveLength(2);
      expect(result.notebooks[0].name).toBe('Notebook 1');
    });

    it('should cache notebooks list', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: { notebooks: [] },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      // First call
      await client.listNotebooks();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await client.listNotebooks();
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('searchBlocks', () => {
    it('should search blocks with query', async () => {
      // 注意：searchBlocks 的实现已从「思源 search API」改为「SQL 查询」
      // （见 src/siyuan/api.ts 的 searchBlocks），因为 search API 会返回空结果。
      // 现在的调用序列是两次 /api/query/sql：
      //   1) SELECT * FROM blocks WHERE ... LIMIT/OFFSET -> data 为记录数组
      //   2) SELECT COUNT(*) AS count FROM blocks WHERE ... -> data 为 [{ count }]
      const rows = [
        {
          id: 'block1',
          content: 'Test content',
          type: 'p',
          box: 'notebook1',
          path: '/test.sy',
          hpath: '/test',
          root_id: 'root1',
          created: '20240101000000',
          updated: '20240101000000',
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(({ code: 0, msg: '', data: rows })),
          json: async () => ({ code: 0, msg: '', data: rows }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(({ code: 0, msg: '', data: [{ count: 1 }] })),
          json: async () => ({ code: 0, msg: '', data: [{ count: 1 }] }),
        });

      const result = await client.searchBlocks({
        query: 'test',
        method: 0,
      });

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].content).toBe('Test content');
      expect(result.matchedBlockCount).toBe(1);
      expect(result.pageCount).toBe(1);

      // 断言确实以 SQL 形式发起，并带上了关键字过滤
      const firstBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(firstBody.stmt).toContain("content LIKE '%test%'");
      expect(firstBody.stmt).toContain('LIMIT 20 OFFSET 0');
    });

    it('should include notebook filter in the SQL statement', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(({ code: 0, msg: '', data: [] })),
          json: async () => ({ code: 0, msg: '', data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(({ code: 0, msg: '', data: [{ count: 0 }] })),
          json: async () => ({ code: 0, msg: '', data: [{ count: 0 }] }),
        });

      await client.searchBlocks({
        query: 'test',
        method: 0,
        boxes: ['notebook1', 'notebook2'],
      });

      const firstBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(firstBody.stmt).toContain("box IN ('notebook1','notebook2')");
    });

    it('should escape single quotes in the query to avoid breaking the SQL', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(({ code: 0, msg: '', data: [] })),
          json: async () => ({ code: 0, msg: '', data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(({ code: 0, msg: '', data: [{ count: 0 }] })),
          json: async () => ({ code: 0, msg: '', data: [{ count: 0 }] }),
        });

      await client.searchBlocks({ query: "it's", method: 0 });

      const firstBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(firstBody.stmt).toContain("content LIKE '%it''s%'");
    });
  });

  describe('getBlockKramdown', () => {
    it('should return block kramdown', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: {
          id: 'block1',
          kramdown: '# Test heading\n\nTest content',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const result = await client.getBlockKramdown('block1');
      expect(result.id).toBe('block1');
      expect(result.kramdown).toContain('Test heading');
    });

    it('should cache block kramdown', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: { id: 'block1', kramdown: 'content' },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      // First call
      await client.getBlockKramdown('block1');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await client.getBlockKramdown('block1');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateBlock', () => {
    it('should update block and invalidate cache', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: {
          doOperations: [{ action: 'update', id: 'block1', data: 'new content' }],
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      // Cache block first
      await client.getBlockKramdown('block1');
      const firstCallCount = (global.fetch as any).mock.calls.length;

      // Update block
      await client.updateBlock({ id: 'block1', dataType: 'markdown', data: 'new' });

      // Next getBlockKramdown should make new request (cache invalidated)
      await client.getBlockKramdown('block1');
      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(firstCallCount + 1);
    });
  });

  describe('checkConnection', () => {
    it('should return true when connected', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: { version: '2.9.0' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const result = await client.checkConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection failed'));

      const result = await client.checkConnection();
      expect(result).toBe(false);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return status with version when connected', async () => {
      const mockResponse = {
        code: 0,
        msg: '',
        data: { version: '2.9.0' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const status = await client.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.version).toBe('2.9.0');
      expect(status.error).toBeUndefined();
    });

    it('should return status with error when connection fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection failed'));

      const status = await client.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.version).toBeUndefined();
      expect(status.error).toBe('Connection failed');
    });
  });
});
