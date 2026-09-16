/**
 * Tests for Retry and Circuit Breaker functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetryHandler,
  CircuitBreaker,
  RequestStats,
  ConcurrencyLimiter,
  CircuitState
} from '../src/core/retry.js';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxRetries: 3,
      backoffMs: 100,
      backoffMultiplier: 2,
      timeout: 5000,
      retryableErrors: ['ECONNREFUSED', 'network']
    });
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryHandler.executeWithRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const result = await retryHandler.executeWithRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      retryHandler.executeWithRetry(fn)
    ).rejects.toThrow('Request failed after 4 attempts');

    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

    await expect(
      retryHandler.executeWithRetry(fn)
    ).rejects.toThrow('Request failed after 1 attempts');

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should timeout long requests', async () => {
    const fn = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 10000))
    );

    await expect(
      retryHandler.executeWithRetry(fn, { timeout: 100 })
    ).rejects.toThrow('Request timeout');
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000
    });
  });

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open after failure threshold', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trigger 3 failures
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should reject requests when OPEN', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trigger failures to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }
    }

    // Now circuit is open, should reject immediately
    await expect(
      circuitBreaker.execute(fn)
    ).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should transition to HALF_OPEN and allow request
    const result = await circuitBreaker.execute(fn);
    expect(result).toBe('success');
  });

  it('should close after success threshold in HALF_OPEN', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }
    }

    // Wait and execute successful requests
    await new Promise(resolve => setTimeout(resolve, 1100));

    await circuitBreaker.execute(fn); // First success in HALF_OPEN
    await circuitBreaker.execute(fn); // Second success -> CLOSED

    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should reset state', () => {
    circuitBreaker.reset();
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(circuitBreaker.getStats().failureCount).toBe(0);
  });
});

describe('RequestStats', () => {
  let stats: RequestStats;

  beforeEach(() => {
    stats = new RequestStats();
  });

  it('should record requests', () => {
    stats.recordRequest(100);
    stats.recordRequest(200);

    const result = stats.getStats();
    expect(result.totalRequests).toBe(2);
    expect(result.averageLatency).toBe('150ms');
  });

  it('should record errors', () => {
    stats.recordError('/api/test', new Error('Test error'));

    const result = stats.getStats();
    expect(result.totalErrors).toBe(1);
    expect(result.lastErrors).toHaveLength(1);
    expect(result.lastErrors[0].error).toBe('Test error');
  });

  it('should calculate error rate', () => {
    stats.recordRequest(100);
    stats.recordRequest(100);
    stats.recordError('/api/test', new Error('Test error'));

    const result = stats.getStats();
    // 约定：errorRate = errorCount / requestCount。
    // recordRequest 与 recordError 是**分开**调用的：真实调用链里
    // （src/siyuan/api.ts 的 request 方法）失败请求会在 catch 里 recordError、
    // 又在 finally 里 recordRequest，所以一次失败同时计入两个计数器。
    // 因此这里是 1 / 2 = 50%，而不是把错误当作额外的一次请求去算 33.33%。
    expect(result.totalRequests).toBe(2);
    expect(result.totalErrors).toBe(1);
    expect(result.errorRate).toBe('50.00%');
  });

  it('should reset stats', () => {
    stats.recordRequest(100);
    stats.recordError('/api/test', new Error('Test error'));
    stats.reset();

    const result = stats.getStats();
    expect(result.totalRequests).toBe(0);
    expect(result.totalErrors).toBe(0);
  });
});

describe('ConcurrencyLimiter', () => {
  let rateLimiter: ConcurrencyLimiter;

  beforeEach(() => {
    rateLimiter = new ConcurrencyLimiter({
      maxConcurrent: 2,
      minTime: 100
    });
  });

  it('should limit concurrent requests', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 50));
      concurrent--;
    };

    const promises = Array(5).fill(null).map(() =>
      rateLimiter.schedule(task)
    );

    await Promise.all(promises);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should respect minimum time between requests', async () => {
    const start = Date.now();

    await rateLimiter.schedule(async () => {});
    await rateLimiter.schedule(async () => {});

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100); // minTime = 100ms
  });
});
