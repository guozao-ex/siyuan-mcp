# SiYuan Plugin MCP

思源笔记 MCP 插件的**配置入口**。

> **本插件不包含任何 AI 能力。** 既没有对话界面，也没有块级 AI 操作。
>
> 原因：AI 对话与写作辅助用现成的 Agent（DSH / Claude Desktop / Cursor）就够了。
> 插件内再复制一套，既增加维护面，又要求用户额外配置一份 LLM Key。
> 现在**整条链路都不需要任何 LLM API Key** —— MCP 只负责在 Agent 与思源之间传递数据和调用。

## 功能

- ⚙️ 配置 MCP 服务器地址与访问 Token
- 🔌 启动时自动探测服务器连通性
- 🌍 中英文界面

## 安装

### 从集市安装（即将支持）

在思源笔记集市中搜索「MCP Integration」并安装。

### 手动安装

1. 下载最新的 release 包（`package.zip`）
2. 解压到 `{workspace}/data/plugins/` 目录
3. 重启思源笔记，在「集市 → 已下载」中启用

> 用于本地开发时可用 `node scripts/deploy-plugin.mjs --workspace="<工作空间>" --build`
> 部署已构建的 `dist/`。注意思源内核**不接受符号链接/junction** 形式的插件目录，必须复制真实文件。

## 配置

1. 确保 MCP 服务器正在运行（`cd mcp-server && npm run build && npm start`）
2. 点击顶栏图标，或在命令面板搜索「设置」
3. 填入 MCP 服务器地址（默认 `http://127.0.0.1:3000`）
4. 若服务器设置了 `MCP_AUTH_TOKEN`，把相同的值填进 Token 栏

## 使用

插件本身没有可操作的功能 —— 它的用途是让你在自己的 AI 客户端里连上这个 MCP 服务器：

**stdio 模式**（推荐，Claude Desktop 等）

```json
{
  "mcpServers": {
    "siyuan": {
      "command": "node",
      "args": ["<path>/mcp-server/dist/index.js"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

**HTTP 模式**

服务器以 `MCP_TRANSPORT=http` 启动后，客户端连 `http://127.0.0.1:3000/mcp`（标准 Streamable HTTP）。

连上之后，你就可以直接让 Agent 搜索、阅读、创建、修改、批量整理你的笔记 —— 共 19 个工具。

## 开发

```bash
npm install
npm run dev        # 监听构建
npm run typecheck  # 仅检查 .ts
npm run build      # 产出 dist/
npm run package    # 打包成符合集市要求的 package.zip
```

## 目录结构

```
src/
├── index.ts          # 插件主入口（顶栏入口、设置）
├── types.ts          # 共享类型与默认设置
├── api/
│   └── mcp.ts        # MCP 服务器 REST 客户端
├── components/
│   └── Settings.svelte
└── styles/
    └── main.css
```

## 许可证

MIT
