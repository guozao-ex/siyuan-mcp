/**
 * Configuration utilities for MCP server
 */

export interface ServerConfig {
  // SiYuan API
  siyuanApiUrl: string;
  siyuanApiToken: string;

  // Transport
  transportMode: 'stdio' | 'http';

  // HTTP Server
  httpPort: number;
  httpHost: string;

  // Auth (HTTP mode only)
  authToken: string;

  // Features
  enableCors: boolean;
  enableLogging: boolean;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  return {
    // SiYuan API
    siyuanApiUrl: process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806',
    siyuanApiToken: process.env.SIYUAN_API_TOKEN || '',

    // Transport
    transportMode: (process.env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',

    // HTTP Server
    httpPort: parseInt(process.env.MCP_PORT || '3000', 10),
    httpHost: process.env.MCP_HOST || '127.0.0.1',

    // Auth：HTTP 模式下访问 MCP / REST 端点所需的共享密钥
    authToken: process.env.MCP_AUTH_TOKEN || '',

    // Features
    enableCors: process.env.MCP_ENABLE_CORS !== 'false',
    enableLogging: process.env.MCP_ENABLE_LOGGING !== 'false',
  };
}

/** 判断监听地址是否为本机回环地址 */
export function isLoopbackHost(host: string): boolean {
  const h = (host || '').trim().toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServerConfig): string[] {
  const errors: string[] = [];

  // Validate SiYuan API URL
  if (!config.siyuanApiUrl) {
    errors.push('SIYUAN_API_URL is required');
  } else {
    try {
      new URL(config.siyuanApiUrl);
    } catch (error) {
      errors.push('SIYUAN_API_URL must be a valid URL');
    }
  }

  // Validate HTTP port
  if (config.transportMode === 'http') {
    if (config.httpPort < 1 || config.httpPort > 65535) {
      errors.push('MCP_PORT must be between 1 and 65535');
    }
  }

  // Validate HTTP host
  if (config.transportMode === 'http') {
    if (!config.httpHost) {
      errors.push('MCP_HOST is required for HTTP mode');
    }
  }

  // 认证校验：一旦监听对外地址，就必须配置 token。
  // 理由：/mcp 与 /tools/call 都能创建、修改、删除笔记，
  // 无认证地暴露到 0.0.0.0 等于把整个笔记库的写权限开放出去。
  // 仅绑回环地址时允许省略（启动时会打印警告）。
  if (config.transportMode === 'http' && config.httpHost && !isLoopbackHost(config.httpHost)) {
    if (!config.authToken) {
      errors.push(
        `MCP_AUTH_TOKEN is required when MCP_HOST is "${config.httpHost}" ` +
          '(only 127.0.0.1 / localhost / ::1 may run without a token)'
      );
    }
  }

  return errors;
}

/**
 * Print configuration summary
 *
 * 注意：一律走 stderr。stdio 模式下 stdout 是 MCP 协议的专用通道。
 */
export function printConfig(config: ServerConfig): void {
  console.error('='.repeat(50));
  console.error('MCP Server Configuration');
  console.error('='.repeat(50));
  console.error(`SiYuan API URL: ${config.siyuanApiUrl}`);
  console.error(`API Token: ${config.siyuanApiToken ? '***' : '(not set)'}`);
  console.error(`Transport Mode: ${config.transportMode}`);

  if (config.transportMode === 'http') {
    console.error(`HTTP Server: http://${config.httpHost}:${config.httpPort}`);
    console.error(`CORS Enabled: ${config.enableCors}`);
    console.error(`Auth Token: ${config.authToken ? 'set' : '(not set)'}`);

    if (!config.authToken && isLoopbackHost(config.httpHost)) {
      console.error(
        'WARNING: MCP_AUTH_TOKEN is not set. Every endpoint is reachable by any process on this machine.'
      );
    }
  }

  console.error(`Logging Enabled: ${config.enableLogging}`);
  console.error('='.repeat(50));
}
