/**
 * Tests for cache utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Cache } from '../src/utils/cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache({ ttl: 1000, maxSize: 3 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should support custom TTL per entry', () => {
      cache.set('key1', 'value1', 500); // 500ms TTL
      cache.set('key2', 'value2', 2000); // 2000ms TTL

      vi.advanceTimersByTime(600);

      expect(cache.get('key1')).toBeUndefined(); // Expired
      expect(cache.get('key2')).toBe('value2'); // Still valid
    });
  });

  describe('size limits', () => {
    it('should evict oldest entry when maxSize exceeded', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);

      expect(cache.size()).toBe(3);

      // Add 4th entry, should evict key1
      cache.set('key4', 'value4');

      expect(cache.size()).toBe(3);
      expect(cache.get('key1')).toBeUndefined(); // Evicted
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(1001);
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete entries', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(1001);

      const removed = cache.cleanup();

      expect(removed).toBe(2);
      expect(cache.size()).toBe(0);
    });

    it('should not remove valid entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(500); // Half of TTL

      const removed = cache.cleanup();

      expect(removed).toBe(0);
      expect(cache.size()).toBe(2);
    });
  });

  describe('stats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.stats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.ttl).toBe(1000);
      expect(stats.oldestEntry).toBeDefined();
    });

    it('should return null oldestEntry for empty cache', () => {
      const stats = cache.stats();
      expect(stats.oldestEntry).toBeNull();
    });
  });
});
