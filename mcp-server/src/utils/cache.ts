/**
 * Cache utility for MCP server
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
}

export class Cache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private options: CacheOptions;

  constructor(options?: Partial<CacheOptions>) {
    this.cache = new Map();
    this.options = {
      ttl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100, // 100 entries default
      ...options,
    };
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const effectiveTtl = ttl || this.options.ttl;

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.options.maxSize) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + effectiveTtl,
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    ttl: number;
    oldestEntry: number | null;
  } {
    let oldestTimestamp: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      ttl: this.options.ttl,
      oldestEntry: oldestTimestamp,
    };
  }

  /**
   * Find oldest cache key
   */
  private findOldestKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Create cache instance with automatic cleanup
 */
export function createCache<T>(options?: Partial<CacheOptions>): Cache<T> {
  const cache = new Cache<T>(options);

  // Run cleanup every minute
  setInterval(() => {
    const removed = cache.cleanup();
    if (removed > 0) {
      console.log(`Cache cleanup: removed ${removed} expired entries`);
    }
  }, 60 * 1000);

  return cache;
}
