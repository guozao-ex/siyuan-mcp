# 方案 A 实现计划

## 目标
插件能够启动和管理独立的 MCP 服务器进程

## 技术挑战

### 1. 思源插件的限制
- 插件运行在浏览器环境（Electron）
- 无法直接启动 Node.js 子进程
- 需要通过 Electron 的 IPC 机制

### 2. 解决方案
使用 Electron 的能力启动子进程：
- 利用思源笔记的内核 API
- 或者通过 Electron remote 模块
- 或者预先启动一个守护进程

## 实施步骤

### Step 1: 打包 MCP 服务器为可执行文件
```bash
# 将 mcp-server 打包为独立可执行文件
npm install -g pkg
pkg mcp-server/dist/index.js --targets node18-win-x64 --output plugin/bin/mcp-server.exe
```

### Step 2: 插件启动进程
```typescript
// 使用 siyuan.IPC 或者直接调用系统命令
const { spawn } = require('child_process');
const mcpProcess = spawn('./bin/mcp-server.exe', ['--port', '3000']);
```

### Step 3: 进程管理
- 监控进程状态
- 自动重启
- 优雅关闭

### Step 4: UI 显示状态
- 实时显示运行状态
- 显示日志
- 错误提示

---

## 立即开始实现

我现在开始：
1. 修改插件代码，实现进程管理
2. 准备 MCP 服务器打包脚本
3. 创建简化的设置界面

开始执行...
