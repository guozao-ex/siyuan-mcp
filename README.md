# 思源 MCP

思源笔记通用 MCP 服务器和配套插件，支持所有 MCP 协议的 AI Agent。

[English](./README_EN.md) | 简体中文

## 功能特性

- 🔧 **完整的 MCP 工具集**：搜索、读取、写入、批量操作、导航（反向链接 / 大纲 / 标签 / 文件树）、资源与系统状态
- 🛡️ **风险分级**：每个工具带 MCP 原生 `annotations`（只读 / 破坏性），危险操作在描述里明确要求先征得用户同意
- 🤖 **AI 集成**：通过 MCP 协议连接各类 AI Agent（Claude Desktop / Cursor / DSH 等），**无需任何 LLM API Key**
- 🔌 **双传输**：stdio（本地 Agent 直连）与 HTTP（自定义 REST + 标准 `POST /mcp`）
- ⚙️ **插件轻量**：思源插件只做 MCP 服务器配置入口，不在插件内复制 AI 能力
- 🌍 **国际化**：插件界面支持中文和英文
- ⚡ **性能与可靠性**：请求缓存、重试、熔断、限流

## 项目结构

```
.
├── mcp-server/          # MCP 服务器（Node 18+ / TypeScript，HTTP 模式默认端口 3000）
│   ├── src/
│   │   ├── core/        # 基础设施（配置、日志、缓存、重试、限流、索引等待）
│   │   ├── server/      # 传输层（自定义 REST + 标准 Streamable HTTP /mcp）
│   │   ├── siyuan/      # 思源 API 封装
│   │   ├── tools/       # MCP 工具实现与注册表（危险操作单独分组）
│   │   └── index.ts
│   ├── tests/           # vitest 测试
│   └── package.json
│
├── mcp-daemon/          # 进程守护：托管 mcp-server 进程，并提供 HTTP 控制接口（端口 3001）
│   ├── src/             # MCPDaemon + DaemonControlServer
│   └── package.json
│
├── siyuan-plugin/       # 思源插件（Svelte 4 / Vite 5）
│   ├── src/
│   │   ├── components/  # 设置面板
│   │   ├── api/         # MCP 服务器客户端
│   │   └── styles/      # 样式文件
│   └── package.json
│
├── scripts/             # 验证与部署工具（协议校验、工具验收、插件部署/打包、守护启动）
│
└── docs/                # 用户文档（guides/ 使用指南、reference/ 参考手册）
```

其中 `mcp-daemon/` 是 MCP 服务器的**进程守护**：负责启动 / 停止 / 重启 `mcp-server` 子进程、维护 PID 文件与日志，
并通过 HTTP 控制接口对外提供控制能力（默认端口 **3001**，接口为 `POST /daemon/start`、`POST /daemon/stop`、
`POST /daemon/restart`、`GET /daemon/status`、`GET /daemon/health`）。
`scripts/start-daemon.bat` / `scripts/start-daemon.sh` 是它的便捷启动脚本。MCP 服务器自身在 HTTP 模式下默认监听 **3000** 端口。

## 快速开始

### 1. MCP 服务器

#### 安装依赖

```bash
cd mcp-server
npm install
```

#### 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
SIYUAN_API_URL=http://127.0.0.1:6806
SIYUAN_API_TOKEN=your-token-here
MCP_TRANSPORT=http
MCP_PORT=3000
```

#### 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 2. 思源插件

#### 安装依赖

```bash
cd siyuan-plugin
npm install
```

#### 开发模式

```bash
npm run dev
```

构建产物会输出到 `dist/` 目录。

#### 安装到思源

**方法 1：符号链接（推荐开发时使用）**

```bash
# Windows
mklink /D "C:\SiYuan\data\plugins\siyuan-plugin-mcp" "D:\DEV\siyuan\siyuan-plugin\dist"

# macOS/Linux
ln -s /path/to/siyuan/siyuan-plugin/dist ~/SiYuan/data/plugins/siyuan-plugin-mcp
```

**方法 2：直接复制**

将 `dist/` 目录复制到思源笔记的 `data/plugins/` 目录。

然后在思源笔记中重载插件。

## 使用方式

### Claude Desktop

在 Claude Desktop 配置文件中添加：

```json
{
  "mcpServers": {
    "siyuan": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SIYUAN_API_URL": "http://127.0.0.1:6806",
        "SIYUAN_API_TOKEN": "your-api-token",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### 思源插件

插件是一个**纯配置入口**：它不内置任何 AI 能力 —— 既没有对话界面，也不做块级 AI 操作。
所有 AI 能力都交给外部 Agent（DSH / Claude Desktop / Cursor 等）通过 MCP 协议完成。

用法只有一步：

1. 点击顶栏图标（或命令面板搜索「设置」）配置 MCP 服务器地址与 Token
2. 在你自己的 AI 客户端里连接这个 MCP 服务器，然后用它读写笔记

> 这样设计的原因：AI 对话与写作辅助用现成的 Agent 就够了，
> 插件内再复制一套既增加维护面，也要求用户额外配置一份 LLM Key。
> 现在**整条链路都不需要任何 LLM API Key** —— MCP 只负责在 Agent 与思源之间传递。

## 配置说明

详细配置说明请参考：
- [MCP 服务器配置](./mcp-server/CONFIG.md)
- [快速上手](./docs/guides/QUICKSTART.md)

## 开发指南

### 运行测试

```bash
cd mcp-server
npm test                # 运行所有测试
npm run test:watch     # 监听模式
npm run test:coverage  # 生成覆盖率报告
```

### 代码规范

代码风格由仓库根目录的两个配置文件约束：

- `.eslintrc.cjs` —— ESLint（`eslint:recommended` + `@typescript-eslint/recommended`）
- `.prettierrc` —— Prettier（`semi: true`、`singleQuote: true`、`tabWidth: 2`、`printWidth: 100` 等）

**注意：目前各子包的 `package.json` 都还没有接入 `lint` / `lint:fix` / `format` 脚本，
eslint 与 prettier 也未列入任何包的依赖，因此没有可直接执行的 `npm run lint` / `npm run format` 命令。**
在脚本接入之前，请以这两个配置文件为准手动对齐风格。

### 构建

```bash
# MCP 服务器
cd mcp-server
npm run build

# 思源插件
cd siyuan-plugin
npm run build        # 产出 dist/
npm run typecheck    # 仅检查 .ts（.svelte 内部的类型错误需要 svelte-check，尚未接入）
npm run package      # 构建并打包成 package.zip
```

### 打包发布（思源插件）

```bash
cd siyuan-plugin
npm run package
```

会在 `siyuan-plugin/package.zip` 生成可分发的插件包。zip 的**根目录**下直接是
`index.js`、`index.css`、`plugin.json`、`i18n/`、`icon.png` 等（没有多余的 `dist/` 层级），
符合思源集市的上架要求。

打包脚本 `scripts/package-plugin.mjs` 是零依赖的跨平台实现（手工构造 ZIP），
在 Windows / macOS / Linux 上行为一致。

### 部署到本地思源调试

思源内核**不接受符号链接/junction** 形式的插件目录，必须把 `dist/` 的真实文件复制进去：

```bash
node scripts/deploy-plugin.mjs --workspace="<思源工作空间路径>" --build
```

工作空间路径可在思源「设置 → 关于」中查看。部署后需在思源中重启应用，
或在「集市 → 已下载」里重载插件。

### 持续集成

`.github/workflows/ci.yml` 在 push / PR 时并行跑三个 job：

| Job | 内容 |
|---|---|
| `mcp-server` | `npm ci` → `tsc --noEmit` → `vitest run` |
| `mcp-daemon` | `npm ci` → `tsc --noEmit` → `npm run build` |
| `siyuan-plugin` | `npm ci` → `npm run typecheck` → `npm run build` → `npm run package` |

两点说明：

- CI 使用 `npm ci`，它要求 `package-lock.json` **已提交**。仓库根目录的 `.gitignore`
  已刻意不再忽略该文件（否则 CI 无法复现依赖）。
- `mcp-server` 的测试套件中有部分用例需要真实思源实例，处于 skip 状态，这是预期行为。

## 文档

- [快速上手](./docs/guides/QUICKSTART.md)
- [使用示例](./docs/guides/EXAMPLES.md)
- [测试指南](./docs/guides/TESTING_GUIDE.md)
- [API 参考](./docs/reference/API.md)
- [配置指南](./mcp-server/CONFIG.md)
- [MCP 服务器测试](./mcp-server/TESTING.md)

## 技术栈

### MCP 服务器
- TypeScript 5.6+
- Node.js 18+
- @modelcontextprotocol/sdk
- Express (HTTP 模式)

### 思源插件
- TypeScript 5.6+
- Svelte 4.2+
- Vite 5.4+
- SiYuan SDK

## 常见问题

### 无法连接到思源 API

- 确认思源笔记正在运行
- 检查 `SIYUAN_API_URL` 配置是否正确
- 如果启用了 API 认证，检查 `SIYUAN_API_TOKEN` 是否有效

### HTTP 服务器无法启动

- 检查端口是否被占用
- 尝试更换端口：`MCP_PORT=3001`
- 检查防火墙设置

### 插件无法加载

- 检查插件是否正确安装到 `data/plugins/` 目录
- 查看思源笔记控制台是否有错误信息
- 尝试重启思源笔记

更多问题请查看 [Issues](https://github.com/guozao-ex/siyuan-mcp/issues)

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 致谢

- [思源笔记](https://github.com/siyuan-note/siyuan)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Anthropic Claude](https://www.anthropic.com/claude)

## 联系方式

- 项目主页：https://github.com/guozao-ex/siyuan-mcp
- 问题反馈：https://github.com/guozao-ex/siyuan-mcp/issues

