/**
 * Enhanced Logger with Winston
 * 增强的日志系统 - 支持日志轮转、分级、查询
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  stack?: string;
}

export interface LogQueryOptions {
  level?: LogLevel;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
  search?: string;
}

/**
 * Enhanced Logger Class
 */
export class EnhancedLogger {
  private logger: winston.Logger;
  private logDir: string;
  private apiCallMetrics: Map<string, { count: number; totalDuration: number; errors: number }>;

  constructor(options?: { logDir?: string; level?: LogLevel; console?: boolean }) {
    this.logDir = options?.logDir || path.join(process.cwd(), 'logs');
    this.apiCallMetrics = new Map();

    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 配置日志格式
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // 配置传输器（Transports）
    const transports: winston.transport[] = [];

    // 错误日志 - 按日期轮转
    transports.push(
      new DailyRotateFile({
        filename: path.join(this.logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d', // 保留14天
        format: logFormat,
      })
    );

    // 完整日志 - 按日期轮转
    transports.push(
      new DailyRotateFile({
        filename: path.join(this.logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d', // 保留7天
        format: logFormat,
      })
    );

    // 控制台输出（开发模式）
    //
    // ⚠️ stdio 传输模式下 stdout 是 MCP 协议的专用通道（逐行 JSON-RPC），
    // 任何写往 stdout 的内容都会破坏协议。而 winston 的 Console transport
    // 默认只把 error 级别写 stderr，info/debug 等一律走 stdout。
    // 因此这里必须用 stderrLevels 把**所有**级别都路由到 stderr。
    // （Node 里 console.error / console.warn 本身就写 stderr，是安全的。）
    // 参见 src/utils/config.ts 的 printConfig()，它也是出于同样原因用 console.error。
    if (options?.console !== false) {
      transports.push(
        new winston.transports.Console({
          stderrLevels: ['error', 'warn', 'info', 'debug'],
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let msg = `${timestamp} [${level}] ${message}`;
              if (Object.keys(meta).length > 0) {
                msg += ` ${JSON.stringify(meta)}`;
              }
              return msg;
            })
          ),
        })
      );
    }

    // 创建 Winston Logger
    this.logger = winston.createLogger({
      level: options?.level || process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports,
    });
  }

  /**
   * 记录错误日志
   */
  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * 记录信息日志
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * 记录调试日志
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * 记录 API 调用
   */
  logApiCall(api: string, duration: number, success: boolean, error?: string): void {
    const logData = {
      api,
      duration: `${duration}ms`,
      success,
      error,
      timestamp: Date.now(),
    };

    if (success) {
      this.logger.info(`API Call: ${api}`, logData);
    } else {
      this.logger.error(`API Call Failed: ${api}`, logData);
    }

    // 更新指标
    const metrics = this.apiCallMetrics.get(api) || {
      count: 0,
      totalDuration: 0,
      errors: 0,
    };

    metrics.count++;
    metrics.totalDuration += duration;
    if (!success) {
      metrics.errors++;
    }

    this.apiCallMetrics.set(api, metrics);
  }

  /**
   * 记录请求开始
   */
  logRequestStart(method: string, endpoint: string, requestId?: string): void {
    this.info(`→ ${method} ${endpoint}`, { requestId, type: 'request_start' });
  }

  /**
   * 记录请求结束
   */
  logRequestEnd(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    requestId?: string
  ): void {
    const level = statusCode >= 400 ? 'error' : 'info';
    this.logger.log(level, `← ${method} ${endpoint} ${statusCode} (${duration}ms)`, {
      requestId,
      statusCode,
      duration,
      type: 'request_end',
    });
  }

  /**
   * 记录服务器事件
   */
  logServerEvent(event: string, data?: any): void {
    this.info(`Server Event: ${event}`, { ...data, type: 'server_event' });
  }

  /**
   * 获取 API 调用指标
   */
  getApiMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    this.apiCallMetrics.forEach((value, key) => {
      metrics[key] = {
        count: value.count,
        averageDuration: Math.round(value.totalDuration / value.count),
        errorRate: ((value.errors / value.count) * 100).toFixed(2) + '%',
        errors: value.errors,
      };
    });

    return metrics;
  }

  /**
   * 查询日志
   */
  async queryLogs(options: LogQueryOptions = {}): Promise<LogEntry[]> {
    const { level, limit = 100, offset = 0, startTime, endTime, search } = options;

    const logFiles = this.getLogFiles();
    const entries: LogEntry[] = [];

    // 读取日志文件
    for (const file of logFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEntry;

            // 过滤条件
            if (level && entry.level !== level) continue;
            if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) continue;
            if (startTime && new Date(entry.timestamp).getTime() < startTime) continue;
            if (endTime && new Date(entry.timestamp).getTime() > endTime) continue;

            entries.push(entry);
          } catch (e) {
            // 跳过无效的 JSON 行
          }
        }
      } catch (e) {
        this.error(`Failed to read log file: ${file}`, { error: e });
      }
    }

    // 按时间倒序排序
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 分页
    return entries.slice(offset, offset + limit);
  }

  /**
   * 获取最近的错误日志
   */
  async getRecentErrors(limit: number = 50): Promise<LogEntry[]> {
    return this.queryLogs({ level: 'error', limit });
  }

  /**
   * 获取日志统计
   */
  async getLogStats(): Promise<{
    totalLogs: number;
    errorLogs: number;
    warnLogs: number;
    logFiles: number;
    oldestLog: string | null;
    newestLog: string | null;
  }> {
    const logFiles = this.getLogFiles();
    let totalLogs = 0;
    let errorLogs = 0;
    let warnLogs = 0;
    let oldestLog: string | null = null;
    let newestLog: string | null = null;

    for (const file of logFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEntry;
            totalLogs++;

            if (entry.level === 'error') errorLogs++;
            if (entry.level === 'warn') warnLogs++;

            const timestamp = new Date(entry.timestamp).getTime();
            if (!oldestLog || timestamp < new Date(oldestLog).getTime()) {
              oldestLog = entry.timestamp;
            }
            if (!newestLog || timestamp > new Date(newestLog).getTime()) {
              newestLog = entry.timestamp;
            }
          } catch (e) {
            // 跳过无效的 JSON 行
          }
        }
      } catch (e) {
        // 跳过无法读取的文件
      }
    }

    return {
      totalLogs,
      errorLogs,
      warnLogs,
      logFiles: logFiles.length,
      oldestLog,
      newestLog,
    };
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(daysToKeep: number = 7): Promise<number> {
    const logFiles = this.getLogFiles();
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of logFiles) {
      const stats = fs.statSync(file);
      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(file);
        deletedCount++;
        this.info(`Deleted old log file: ${path.basename(file)}`);
      }
    }

    return deletedCount;
  }

  /**
   * 获取所有日志文件
   */
  private getLogFiles(): string[] {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }

    return fs
      .readdirSync(this.logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(this.logDir, file))
      .sort((a, b) => {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtimeMs - statA.mtimeMs; // 最新的在前
      });
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): string {
    return this.logger.level;
  }

  /**
   * 导出日志（用于故障排查）
   */
  async exportLogs(outputPath: string, options?: LogQueryOptions): Promise<void> {
    const logs = await this.queryLogs(options);
    const content = logs.map(log => JSON.stringify(log)).join('\n');
    fs.writeFileSync(outputPath, content, 'utf-8');
    this.info(`Logs exported to: ${outputPath}`, { count: logs.length });
  }
}

/**
 * 创建单例日志实例
 */
let loggerInstance: EnhancedLogger | null = null;

export function createLogger(options?: {
  logDir?: string;
  level?: LogLevel;
  console?: boolean;
}): EnhancedLogger {
  if (!loggerInstance) {
    loggerInstance = new EnhancedLogger(options);
  }
  return loggerInstance;
}

export function getLogger(): EnhancedLogger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

/**
 * 导出默认日志实例
 */
export const logger = getLogger();
