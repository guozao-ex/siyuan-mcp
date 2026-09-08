# 思源 MCP

思源笔记通用 MCP 服务器和配套插件，支持所有 MCP 协议的 AI Agent。

## 项目结构

```
.
├── mcp-server/          # MCP 服务器
│   ├── src/
│   │   ├── tools/       # MCP 工具实现
│   │   ├── siyuan/      # 思源 API 封装
│   │   └── utils/       # 工具函数
│   └── package.json
│
└── siyuan-plugin/       # 思源插件
    ├── src/
    │   ├── components/  # UI 组件
    │   ├── api/         # API 调用
    │   └── styles/      # 样式文件
    └── package.json
```

## 功能特性

- 🔍 笔记搜索：支持全文搜索和块搜索
- 📖 笔记读取：支持读取笔记内容
- ✍️ 笔记写入：支持创建和修改笔记
- 🤖 AI 集成：通过 MCP 协议连接各类 AI Agent
- 🎨 插件 UI：提供友好的交互界面

## 快速开始

### MCP 服务器

```bash
cd mcp-server
npm install
npm run dev
```

### 思源插件

```bash
cd siyuan-plugin
npm install
npm run dev
```

## 开发状态

当前处于开发阶段，详细开发计划请查看 [PROJECT_PLAN.md](./PROJECT_PLAN.md)

## 许可证

MIT
