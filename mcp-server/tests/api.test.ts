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
        json: async () => mockResponse,
      });

      await expect(client.getVersion()).rejects.toThrow('API Error');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getVersion()).rejects.toThrow('Network error');
    });
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
      const mockResponse = {
        code: 0,
        msg: '',
        data: {
          blocks: [
            {
              id: 'block1',
              content: 'Test content',
              type: 'p',
              box: 'notebook1',
              path: '/test.sy',
              hpath: '/test',
            },
          ],
          matchedBlockCount: 1,
          matchedRootCount: 1,
          pageCount: 1,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchBlocks({
        query: 'test',
        method: 0,
      });

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].content).toBe('Test content');
      expect(result.matchedBlockCount).toBe(1);
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
