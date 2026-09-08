/**
 * Rate limiter utility
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export class RateLimiter {
  private requests: Map<string, number[]>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.requests = new Map();
    this.config = config;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get request timestamps for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Filter out old timestamps
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.config.maxRequests) {
      this.requests.set(identifier, timestamps);
      return false;
    }

    // Add new timestamp
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return true;
  }

  /**
   * Get remaining requests
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const timestamps = this.requests.get(identifier) || [];
    const recentCount = timestamps.filter((ts) => ts > windowStart).length;

    return Math.max(0, this.config.maxRequests - recentCount);
  }

  /**
   * Get reset time
   */
  getResetTime(identifier: string): number {
    const timestamps = this.requests.get(identifier) || [];

    if (timestamps.length === 0) {
      return Date.now();
    }

    const oldestTimestamp = Math.min(...timestamps);
    return oldestTimestamp + this.config.windowMs;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((ts) => ts > windowStart);

      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }
}

/**
 * Create rate limiter instance
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
