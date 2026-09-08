# 思源 MCP

思源笔记通用 MCP 服务器和配套插件，支持所有 MCP 协议的 AI Agent。

[English](./README_EN.md) | 简体中文

## 功能特性

- 🔍 **笔记搜索**：支持全文搜索和块搜索
- 📖 **笔记读取**：支持读取笔记内容
- ✍️ **笔记写入**：支持创建和修改笔记
- 🤖 **AI 集成**：通过 MCP 协议连接各类 AI Agent
- 🎨 **插件 UI**：提供友好的交互界面
- 🌍 **国际化**：支持中文和英文
- ⚡ **性能优化**：请求缓存和速率限制

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

1. 点击顶栏 AI 图标打开对话面板
2. 右键点击块，选择 AI 操作：
   - 总结内容
   - 继续写作
   - 改进文字
3. 在设置中配置 MCP 服务器地址

## 配置说明

详细配置说明请参考：
- [MCP 服务器配置](./mcp-server/CONFIG.md)
- [开发环境配置](./DEVELOPMENT.md)

## 开发指南

### 运行测试

```bash
cd mcp-server
npm test                # 运行所有测试
npm run test:watch     # 监听模式
npm run test:coverage  # 生成覆盖率报告
```

### 代码规范

```bash
npm run lint           # 检查代码
npm run lint:fix       # 自动修复
npm run format         # 格式化代码
```

### 构建

```bash
# MCP 服务器
cd mcp-server
npm run build

# 思源插件
cd siyuan-plugin
npm run build
```

## 文档

- [开发环境指南](./DEVELOPMENT.md)
- [配置指南](./mcp-server/CONFIG.md)
- [测试指南](./mcp-server/TESTING.md)
- [项目计划](./PROJECT_PLAN.md)

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

## 开发状态

当前版本：v0.1.0

- ✅ Phase 1: 项目初始化与基础设施
- ✅ Phase 2: MCP 服务器核心开发
- ✅ Phase 3: 思源插件 UI 开发
- ✅ Phase 4: 集成与优化
- 🔄 Phase 5: 测试与文档
- ⏳ Phase 6: 发布准备

详细计划请查看 [PROJECT_PLAN.md](./PROJECT_PLAN.md)

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

