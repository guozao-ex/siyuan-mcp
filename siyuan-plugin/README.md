# SiYuan Plugin MCP

思源笔记 MCP 插件，为 AI Agent 提供友好的交互界面。

## 功能特性

- 🤖 AI 对话面板
- 📝 块级 AI 操作（总结、续写、改进）
- ⚙️ 灵活的配置管理
- 🌍 国际化支持

## 安装

### 从集市安装（即将支持）

在思源笔记集市中搜索「MCP Integration」并安装。

### 手动安装

1. 下载最新的 release 包
2. 解压到 `{workspace}/data/plugins/` 目录
3. 重启思源笔记

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 配置

1. 确保 MCP 服务器正在运行
2. 在插件设置中配置 MCP 服务器地址
3. 配置思源 API Token

## 使用

### AI 对话

点击顶栏图标打开 AI 对话面板，直接与 AI 对话。

### 块级操作

在编辑器中右键点击块，选择：
- 总结内容
- 继续写作
- 改进文字

## 目录结构

```
src/
├── index.ts          # 插件主入口
├── components/       # UI 组件
│   ├── AiPanel.svelte
│   └── Settings.svelte
├── api/              # API 调用
│   └── mcp.ts
└── styles/           # 样式文件
    └── main.css
```

## 许可证

MIT
