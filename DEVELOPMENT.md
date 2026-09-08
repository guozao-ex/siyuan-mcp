# 思源 MCP 开发环境指南

## 环境要求

- Node.js >= 18
- npm >= 9 或 pnpm >= 8
- 思源笔记 >= 2.9.0

## 项目结构

本项目采用 monorepo 结构，包含两个子项目：

### 1. MCP 服务器 (`mcp-server/`)

提供 MCP 协议服务，连接 AI Agent 和思源笔记。

**技术栈：**
- TypeScript
- @modelcontextprotocol/sdk
- Node.js

**开发命令：**
```bash
cd mcp-server
npm install
npm run dev    # 开发模式
npm run build  # 构建
npm start      # 运行构建后的服务
```

### 2. 思源插件 (`siyuan-plugin/`)

提供用户界面，在思源笔记中集成 AI 功能。

**技术栈：**
- TypeScript
- Svelte 4
- Vite
- Sass

**开发命令：**
```bash
cd siyuan-plugin
npm install
npm run dev    # 开发模式（自动重新构建）
npm run build  # 构建生产版本
```

## 开发流程

### 1. 初始化开发环境

```bash
# 安装 MCP 服务器依赖
cd mcp-server
npm install

# 安装插件依赖
cd ../siyuan-plugin
npm install
```

### 2. 配置思源笔记 API

创建 `mcp-server/.env` 文件：

```env
SIYUAN_API_URL=http://127.0.0.1:6806
SIYUAN_API_TOKEN=your-api-token-here
MCP_TRANSPORT=stdio
```

获取 API Token：
1. 打开思源笔记
2. 设置 → 关于 → API Token
3. 复制 Token 到 `.env` 文件

### 3. 启动开发

**终端 1 - MCP 服务器：**
```bash
cd mcp-server
npm run dev
```

**终端 2 - 思源插件：**
```bash
cd siyuan-plugin
npm run dev
```

插件开发时，构建产物会输出到 `siyuan-plugin/dist/` 目录。

### 4. 安装插件到思源

开发模式下，可以通过符号链接安装插件：

**Windows:**
```bash
mklink /D "C:\SiYuan\data\plugins\siyuan-plugin-mcp" "D:\DEV\siyuan\siyuan-plugin\dist"
```

**macOS/Linux:**
```bash
ln -s /path/to/siyuan/siyuan-plugin/dist ~/SiYuan/data/plugins/siyuan-plugin-mcp
```

然后在思源笔记中重载插件。

## 代码规范

### ESLint

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix
```

### Prettier

```bash
# 格式化代码
npm run format

# 检查格式
npm run format:check
```

## 调试

### MCP 服务器调试

1. 在 VS Code 中打开项目
2. 在 `mcp-server/src/index.ts` 设置断点
3. 按 F5 启动调试

### 插件调试

1. 在思源笔记中打开开发者工具（帮助 → 开发者工具）
2. 在 Console 中查看日志
3. 使用 `console.log()` 输出调试信息

## 常见问题

### 1. MCP 服务器连接失败

- 检查 `SIYUAN_API_URL` 是否正确
- 确认思源笔记正在运行
- 检查 API Token 是否有效

### 2. 插件无法加载

- 检查插件是否正确安装到 `data/plugins/` 目录
- 查看思源笔记控制台是否有错误信息
- 尝试重启思源笔记

### 3. 构建失败

- 删除 `node_modules` 并重新安装
- 检查 Node.js 版本是否符合要求
- 查看构建错误信息

## 测试

测试将在 Phase 5 中添加。

## 发布

构建生产版本：

```bash
# MCP 服务器
cd mcp-server
npm run build

# 思源插件
cd siyuan-plugin
npm run build
```

## 参考资料

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [思源笔记插件开发指南](https://github.com/siyuan-note/plugin-sample)
- [Svelte Documentation](https://svelte.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## 许可证

MIT
