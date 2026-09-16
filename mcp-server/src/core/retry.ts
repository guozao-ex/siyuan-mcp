/**
 * Retry and Error Recovery Utilities
 * 重试和错误恢复工具
 */

import Bottleneck from 'bottleneck';

export interface RetryOptions {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  timeout: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常状态
  OPEN = 'OPEN',         // 熔断状态
  HALF_OPEN = 'HALF_OPEN' // 半开状态
}

/**
 * 熔断器 - 防止级联失败
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
      // 尝试半开状态
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt
    };
  }
}

/**
 * 重试处理器
 */
export class RetryHandler {
  private defaultOptions: RetryOptions = {
    maxRetries: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    timeout: 10000,
    retryableErrors: [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'fetch failed',
      'network',
      'timeout'
    ]
  };

  constructor(options?: Partial<RetryOptions>) {
    if (options) {
      this.defaultOptions = { ...this.defaultOptions, ...options };
    }
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;
    let attemptsMade = 0;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      attemptsMade = attempt + 1;
      try {
        return await this.withTimeout(fn(), opts.timeout);
      } catch (error: any) {
        lastError = error;

        // 如果不是最后一次尝试，并且错误可重试
        if (attempt < opts.maxRetries && this.shouldRetry(error, opts)) {
          const backoff = this.calculateBackoff(attempt, opts);
          // console.warn 在 Node 中写 stderr，不会污染 stdio 模式的 MCP 协议通道
          console.warn(
            `Request failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), ` +
            `retrying in ${backoff}ms... Error: ${error.message}`
          );
          await this.delay(backoff);
          continue;
        }

        // 不再重试
        break;
      }
    }

    // 用**真实**尝试次数，而不是 opts.maxRetries + 1。
    // 旧实现无论实际试了几次都报 maxRetries + 1：遇到不可重试的错误时
    // 明明只请求了 1 次却报 "after 4 attempts"，会严重误导线上排查。
    throw new Error(
      `Request failed after ${attemptsMade} attempts: ${lastError?.message || 'Unknown error'}`,
      { cause: lastError }
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      )
    ]);
  }

  private shouldRetry(error: any, options: RetryOptions): boolean {
    const errorMessage = error.message || error.toString();
    return options.retryableErrors.some(retryable =>
      errorMessage.toLowerCase().includes(retryable.toLowerCase())
    );
  }

  private calculateBackoff(attempt: number, options: RetryOptions): number {
    // 指数退避 + 随机抖动
    const exponentialBackoff = options.backoffMs * Math.pow(options.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.3 * exponentialBackoff; // ±30% 抖动
    return Math.min(exponentialBackoff + jitter, 30000); // 最大30秒
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 请求统计
 */
export class RequestStats {
  private requestCount: number = 0;
  private errorCount: number = 0;
  private totalLatency: number = 0;
  private lastErrors: Array<{ timestamp: number; error: string; endpoint: string }> = [];
  private maxErrorHistory: number = 100;

  recordRequest(latency: number): void {
    this.requestCount++;
    this.totalLatency += latency;
  }

  recordError(endpoint: string, error: any): void {
    this.errorCount++;
    this.lastErrors.push({
      timestamp: Date.now(),
      error: error.message || String(error),
      endpoint
    });

    // 只保留最近的错误
    if (this.lastErrors.length > this.maxErrorHistory) {
      this.lastErrors.shift();
    }
  }

  getStats() {
    const recentErrors = this.lastErrors.filter(
      e => Date.now() - e.timestamp < 60000 // 最近1分钟
    );

    return {
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      errorRate: this.requestCount > 0
        ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%'
        : '0%',
      averageLatency: this.requestCount > 0
        ? Math.round(this.totalLatency / this.requestCount) + 'ms'
        : '0ms',
      recentErrors: recentErrors.length,
      lastErrors: this.lastErrors.slice(-10) // 最近10个错误
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalLatency = 0;
    this.lastErrors = [];
  }
}

/**
 * 速率限制器
 */
export class ConcurrencyLimiter {
  private limiter: Bottleneck;

  constructor(config?: {
    maxConcurrent?: number;
    minTime?: number;
    reservoir?: number;
    reservoirRefreshAmount?: number;
    reservoirRefreshInterval?: number;
  }) {
    this.limiter = new Bottleneck({
      maxConcurrent: config?.maxConcurrent || 10,
      minTime: config?.minTime || 10,
      reservoir: config?.reservoir || 100,
      reservoirRefreshAmount: config?.reservoirRefreshAmount || 100,
      reservoirRefreshInterval: config?.reservoirRefreshInterval || 1000
    });
  }

  async schedule<T>(fn: () => Promise<T>, priority?: number): Promise<T> {
    return this.limiter.schedule({ priority: priority || 5 }, fn);
  }

  getStats() {
    return {
      running: this.limiter.running(),
      queued: this.limiter.queued(),
      // @ts-ignore
      done: this.limiter.done
    };
  }
}
