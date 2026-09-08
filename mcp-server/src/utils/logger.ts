/**
 * Logger utility for MCP server
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableColors: boolean;
}

export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableTimestamp: true,
      enableColors: true,
      ...config,
    };
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * Format log message
   */
  private format(level: string, message: string, data?: any): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${this.formatTimestamp()}]`);
    }

    parts.push(`[${level}]`);
    parts.push(message);

    if (data !== undefined) {
      if (typeof data === 'object') {
        parts.push(JSON.stringify(data, null, 2));
      } else {
        parts.push(String(data));
      }
    }

    return parts.join(' ');
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.error(this.format('DEBUG', message, data));
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    if (this.config.level <= LogLevel.INFO) {
      console.error(this.format('INFO', message, data));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    if (this.config.level <= LogLevel.WARN) {
      console.error(this.format('WARN', message, data));
    }
  }

  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    if (this.config.level <= LogLevel.ERROR) {
      console.error(this.format('ERROR', message, data));
    }
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, params?: any): void {
    this.debug(`API Request: ${method} ${path}`, params);
  }

  /**
   * Log API response
   */
  logResponse(method: string, path: string, duration: number, success: boolean): void {
    const message = `API Response: ${method} ${path} - ${duration}ms - ${
      success ? 'SUCCESS' : 'FAILED'
    }`;

    if (success) {
      this.debug(message);
    } else {
      this.warn(message);
    }
  }

  /**
   * Log tool call
   */
  logToolCall(toolName: string, args: any, duration: number, success: boolean): void {
    const message = `Tool Call: ${toolName} - ${duration}ms - ${
      success ? 'SUCCESS' : 'FAILED'
    }`;

    if (success) {
      this.info(message, { args });
    } else {
      this.error(message, { args });
    }
  }
}

/**
 * Create logger instance from environment
 */
export function createLogger(): Logger {
  const levelStr = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  const level = LogLevel[levelStr as keyof typeof LogLevel] || LogLevel.INFO;

  return new Logger({
    level,
    enableTimestamp: process.env.LOG_TIMESTAMP !== 'false',
    enableColors: process.env.LOG_COLORS !== 'false',
  });
}

/**
 * Global logger instance
 */
export const logger = createLogger();
