/**
 * MCP Daemon - Main Entry Point
 * 守护进程主程序 - 管理 MCP 服务器的启动、停止、监控
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';

export interface DaemonConfig {
  mcpServerPath: string;
  port: number;
  pidFile: string;
  logFile: string;
  restartDelay: number;
  maxRestarts: number;
  healthCheckInterval: number;
}

export class MCPDaemon {
  private config: DaemonConfig;
  private serverProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private restartCount: number = 0;
  private lastRestartTime: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private intentionalStop: boolean = false;

  constructor(config: Partial<DaemonConfig> = {}) {
    this.config = {
      mcpServerPath: config.mcpServerPath || path.join(process.cwd(), '../mcp-server/dist/index.js'),
      port: config.port || 3001,
      pidFile: config.pidFile || path.join(process.cwd(), '.mcp-daemon.pid'),
      logFile: config.logFile || path.join(process.cwd(), 'daemon.log'),
      restartDelay: config.restartDelay || 5000,
      maxRestarts: config.maxRestarts || 10,
      healthCheckInterval: config.healthCheckInterval || 30000,
    };
  }

  /**
   * 启动 MCP 服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('MCP Server is already running');
    }

    this.log('Starting MCP Server...');

    try {
      // 检查服务器文件是否存在
      if (!fs.existsSync(this.config.mcpServerPath)) {
        throw new Error(`MCP Server not found at: ${this.config.mcpServerPath}`);
      }

      // 启动服务器进程
      this.serverProcess = spawn('node', [this.config.mcpServerPath], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_TRANSPORT: 'http',
          MCP_PORT: '3000',
        },
      });

      const pid = this.serverProcess.pid;
      if (!pid) {
        throw new Error('Failed to get process PID');
      }

      // 保存 PID
      fs.writeFileSync(this.config.pidFile, String(pid));
      this.log(`MCP Server started with PID: ${pid}`);

      this.isRunning = true;
      this.startTime = Date.now();
      this.restartCount = 0;
      this.intentionalStop = false;

      // 监听进程输出
      if (this.serverProcess.stdout) {
        this.serverProcess.stdout.on('data', (data) => {
          this.log(`[MCP] ${data.toString().trim()}`);
        });
      }

      if (this.serverProcess.stderr) {
        this.serverProcess.stderr.on('data', (data) => {
          this.log(`[MCP ERROR] ${data.toString().trim()}`);
        });
      }

      // 监听进程退出
      this.serverProcess.on('exit', (code, signal) => {
        this.log(`MCP Server exited with code ${code}, signal ${signal}`);
        this.isRunning = false;
        this.serverProcess = null;

        // 自动重启（stop() 主动停止触发的退出不算异常崩溃，不重启）
        if (code !== 0 && !this.intentionalStop && this.shouldRestart()) {
          this.log(`Attempting automatic restart (${this.restartCount + 1}/${this.config.maxRestarts})...`);
          setTimeout(() => {
            this.restart().catch((error) => {
              this.log(`Restart failed: ${error.message}`);
            });
          }, this.config.restartDelay);
        }
      });

      // 启动健康检查
      this.startHealthCheck();

    } catch (error: any) {
      this.log(`Failed to start MCP Server: ${error.message}`);
      throw error;
    }
  }

  /**
   * 停止 MCP 服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.serverProcess) {
      this.log('MCP Server is not running');
      return;
    }

    this.log('Stopping MCP Server...');

    // 标记为「主动停止」：退出回调不应把这次退出当成异常崩溃而自动拉起
    this.intentionalStop = true;

    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // 固定引用：exit 回调会把 this.serverProcess 置空，后续必须靠局部引用继续操作
    const proc = this.serverProcess;
    const gracefulTimeoutMs = 5000;

    try {
      // 先尝试优雅关闭
      proc.kill('SIGTERM');

      // 等待进程退出。waitForExit 超时返回 false 而不是 reject，
      // 这样「优雅关闭超时 → 强制 kill」的兜底逻辑才真正可达
      const exitedGracefully = await this.waitForExit(proc, gracefulTimeoutMs);

      if (!exitedGracefully) {
        this.log(`MCP Server did not exit within ${gracefulTimeoutMs}ms, force killing...`);
        proc.kill('SIGKILL');

        const exitedAfterKill = await this.waitForExit(proc, 2000);
        if (!exitedAfterKill) {
          this.log('MCP Server still alive after SIGKILL, give up waiting');
        }
      }

      this.isRunning = false;
      this.serverProcess = null;

      // 删除 PID 文件
      if (fs.existsSync(this.config.pidFile)) {
        fs.unlinkSync(this.config.pidFile);
      }

      this.log('MCP Server stopped');
    } catch (error: any) {
      this.log(`Error stopping MCP Server: ${error.message}`);
      throw error;
    }
  }

  /**
   * 重启 MCP 服务器
   */
  async restart(): Promise<void> {
    this.log('Restarting MCP Server...');

    if (this.isRunning) {
      await this.stop();
    }

    this.restartCount++;
    this.lastRestartTime = Date.now();

    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * 获取状态
   */
  getStatus(): {
    isRunning: boolean;
    pid: number | null;
    uptime: number;
    restartCount: number;
  } {
    return {
      isRunning: this.isRunning,
      pid: this.serverProcess?.pid || null,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      restartCount: this.restartCount,
    };
  }

  /**
   * 检查是否应该重启
   */
  private shouldRestart(): boolean {
    // 如果重启次数超过限制
    if (this.restartCount >= this.config.maxRestarts) {
      this.log(`Max restart limit (${this.config.maxRestarts}) reached`);
      return false;
    }

    // 如果在短时间内频繁重启，停止自动重启
    const timeSinceLastRestart = Date.now() - this.lastRestartTime;
    if (timeSinceLastRestart < 10000 && this.restartCount > 3) {
      this.log('Too many restarts in short time, stopping automatic restart');
      return false;
    }

    return true;
  }

  /**
   * 等待进程退出
   * @param proc 被等待的子进程（不能依赖 this.serverProcess，exit 回调会把它置空）
   * @param timeout 超时毫秒数
   * @returns 进程是否已退出；超时返回 false（不抛异常，由调用方决定是否强制终止）
   */
  private waitForExit(proc: ChildProcess, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      // 已经退出则直接返回
      if (proc.exitCode !== null || proc.signalCode !== null) {
        resolve(true);
        return;
      }

      let timer: NodeJS.Timeout | null = null;

      const onExit = (): void => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        resolve(true);
      };

      timer = setTimeout(() => {
        proc.removeListener('exit', onExit);
        resolve(false);
      }, timeout);

      proc.once('exit', onExit);
    });
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        // 检查进程是否还在运行
        if (this.serverProcess && this.serverProcess.pid) {
          // 在 Windows 上检查进程
          const isAlive = this.isProcessAlive(this.serverProcess.pid);
          if (!isAlive) {
            this.log('Health check failed: process not alive');
            this.isRunning = false;
          }
        }
      } catch (error: any) {
        this.log(`Health check error: ${error.message}`);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 检查进程是否存活
   */
  private isProcessAlive(pid: number): boolean {
    try {
      // 发送信号 0 不会杀死进程，只是检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 记录日志
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // 输出到控制台
    console.log(logMessage.trim());

    // 写入日志文件
    try {
      fs.appendFileSync(this.config.logFile, logMessage);
    } catch (error) {
      // 忽略日志写入错误
    }
  }
}

/**
 * HTTP 控制服务器
 */
export class DaemonControlServer {
  private daemon: MCPDaemon;
  private app: express.Application;
  private port: number;

  constructor(daemon: MCPDaemon, port: number = 3001) {
    this.daemon = daemon;
    this.port = port;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // 启动服务器
    this.app.post('/daemon/start', async (req, res) => {
      try {
        await this.daemon.start();
        res.json({ success: true, message: 'MCP Server started' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 停止服务器
    this.app.post('/daemon/stop', async (req, res) => {
      try {
        await this.daemon.stop();
        res.json({ success: true, message: 'MCP Server stopped' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 重启服务器
    this.app.post('/daemon/restart', async (req, res) => {
      try {
        await this.daemon.restart();
        res.json({ success: true, message: 'MCP Server restarted' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取状态
    this.app.get('/daemon/status', (req, res) => {
      const status = this.daemon.getStatus();
      res.json(status);
    });

    // 健康检查
    this.app.get('/daemon/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });
  }

  listen(): void {
    this.app.listen(this.port, () => {
      console.log(`Daemon control server listening on port ${this.port}`);
    });
  }
}

// 主程序
// 跨平台判断「是否作为主程序直接运行」：
// Windows 上 import.meta.url 是 file:///D:/... 而 `file://${process.argv[1]}` 会拼出
// file://D:\...，两者永远不相等；必须用 pathToFileURL 做 URL 规范化后再比较。
const isMainModule =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const daemon = new MCPDaemon();
  const controlServer = new DaemonControlServer(daemon, 3001);

  // 启动控制服务器
  controlServer.listen();

  // 处理退出信号
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  console.log('MCP Daemon started. Use HTTP API on port 3001 to control the server.');
}
