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

    // Features
    enableCors: process.env.MCP_ENABLE_CORS !== 'false',
    enableLogging: process.env.MCP_ENABLE_LOGGING !== 'false',
  };
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

  return errors;
}

/**
 * Print configuration summary
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
  }

  console.error(`Logging Enabled: ${config.enableLogging}`);
  console.error('='.repeat(50));
}
