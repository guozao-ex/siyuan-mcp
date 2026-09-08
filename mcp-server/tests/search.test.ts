/**
 * Tests for search tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchNotes, listNotebooks, formatSearchResults } from '../src/tools/search';
import type { SiYuanClient } from '../src/siyuan/api';

describe('Search Tools', () => {
  let mockClient: SiYuanClient;

  beforeEach(() => {
    mockClient = {
      searchBlocks: vi.fn(),
      listNotebooks: vi.fn(),
    } as any;
  });

  describe('searchNotes', () => {
    it('should search notes and format results', async () => {
      const mockResponse = {
        blocks: [
          {
            id: 'block1',
            type: 'p',
            content: '<span>Test content</span>',
            box: 'notebook1',
            path: '/test.sy',
            hpath: '/Test',
            created: '20240101120000',
            updated: '20240101130000',
          },
        ],
        matchedBlockCount: 1,
        matchedRootCount: 1,
        pageCount: 1,
      };

      (mockClient.searchBlocks as any).mockResolvedValueOnce(mockResponse);

      const result = await searchNotes(mockClient, {
        query: 'test',
        page: 1,
        pageSize: 20,
      });

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].id).toBe('block1');
      expect(result.blocks[0].type).toBe('paragraph');
      expect(result.blocks[0].content).toBe('Test content');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        blocks: [],
        matchedBlockCount: 0,
        matchedRootCount: 0,
        pageCount: 0,
      };

      (mockClient.searchBlocks as any).mockResolvedValueOnce(mockResponse);

      const result = await searchNotes(mockClient, { query: 'nonexistent' });

      expect(result.blocks).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter by notebooks', async () => {
      const mockResponse = {
        blocks: [],
        matchedBlockCount: 0,
        matchedRootCount: 0,
        pageCount: 0,
      };

      (mockClient.searchBlocks as any).mockResolvedValueOnce(mockResponse);

      await searchNotes(mockClient, {
        query: 'test',
        notebooks: ['notebook1', 'notebook2'],
      });

      expect(mockClient.searchBlocks).toHaveBeenCalledWith(
        expect.objectContaining({
          boxes: ['notebook1', 'notebook2'],
        })
      );
    });
  });

  describe('listNotebooks', () => {
    it('should list all notebooks', async () => {
      const mockResponse = {
        notebooks: [
          { id: '1', name: 'Work', icon: '📔', sort: 0, closed: false },
          { id: '2', name: 'Personal', icon: '📗', sort: 1, closed: false },
          { id: '3', name: 'Archive', icon: '📕', sort: 2, closed: true },
        ],
      };

      (mockClient.listNotebooks as any).mockResolvedValueOnce(mockResponse);

      const result = await listNotebooks(mockClient);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Work');
      expect(result[1].name).toBe('Personal');
      expect(result[2].closed).toBe(true);
    });

    it('should handle empty notebooks list', async () => {
      const mockResponse = { notebooks: [] };

      (mockClient.listNotebooks as any).mockResolvedValueOnce(mockResponse);

      const result = await listNotebooks(mockClient);

      expect(result).toHaveLength(0);
    });
  });

  describe('formatSearchResults', () => {
    it('should format search results as readable text', () => {
      const result = {
        blocks: [
          {
            id: 'block1',
            type: 'paragraph',
            content: 'Test content',
            path: '/Test',
            notebook: 'notebook1',
            created: '20240101120000',
            updated: '20240101130000',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      const formatted = formatSearchResults(result);

      expect(formatted).toContain('Found 1 results');
      expect(formatted).toContain('page 1');
      expect(formatted).toContain('[paragraph]');
      expect(formatted).toContain('/Test');
      expect(formatted).toContain('block1');
      expect(formatted).toContain('Test content');
    });

    it('should handle empty results', () => {
      const result = {
        blocks: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };

      const formatted = formatSearchResults(result);

      expect(formatted).toContain('Found 0 results');
    });
  });
});
