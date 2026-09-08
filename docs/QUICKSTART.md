# 快速开始指南

本指南将帮助你在 10 分钟内完成思源 MCP 的安装和配置。

## 前置要求

- Node.js >= 18
- npm >= 9
- 思源笔记 >= 2.9.0

## 第一步：安装 MCP 服务器

### 1.1 克隆仓库

```bash
git clone https://github.com/guozao-ex/siyuan-mcp.git
cd siyuan-mcp/mcp-server
```

### 1.2 安装依赖

```bash
npm install
```

### 1.3 配置环境变量

创建 `.env` 文件：

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置
nano .env  # 或使用你喜欢的编辑器
```

最小配置：

```bash
SIYUAN_API_URL=http://127.0.0.1:6806
MCP_TRANSPORT=http
MCP_PORT=3000
```

### 1.4 获取 API Token（如果启用了认证）

1. 打开思源笔记
2. 点击 **设置** → **关于** → **API Token**
3. 复制 Token
4. 在 `.env` 中添加：
   ```bash
   SIYUAN_API_TOKEN=your-token-here
   ```

### 1.5 启动服务器

```bash
npm run dev
```

看到以下输出表示成功：

```
==================================================
MCP Server Configuration
==================================================
SiYuan API URL: http://127.0.0.1:6806
API Token: ***
Transport Mode: http
HTTP Server: http://127.0.0.1:3000
==================================================
[INFO] Connected to SiYuan version 2.9.0
[INFO] HTTP server listening on http://127.0.0.1:3000
```

## 第二步：测试 MCP 服务器

### 2.1 健康检查

在新终端中运行：

```bash
curl http://127.0.0.1:3000/health
```

预期输出：

```json
{
  "status": "ok",
  "timestamp": 1234567890123
}
```

### 2.2 列出笔记本

```bash
curl -X POST http://127.0.0.1:3000/notebooks \
  -H "Content-Type: application/json"
```

预期输出：

```json
{
  "content": [
    {
      "type": "text",
      "text": "[{\"id\":\"...\",\"name\":\"我的笔记本\",\"icon\":\"📔\",\"closed\":false}]"
    }
  ]
}
```

### 2.3 搜索笔记

```bash
curl -X POST http://127.0.0.1:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "pageSize": 3}'
```

## 第三步：安装思源插件

### 3.1 构建插件

```bash
cd ../siyuan-plugin
npm install
npm run build
```

### 3.2 安装到思源

**方法 1：开发模式（推荐）**

Windows:
```bash
mklink /D "C:\SiYuan\data\plugins\siyuan-plugin-mcp" "D:\siyuan-mcp\siyuan-plugin\dist"
```

macOS/Linux:
```bash
ln -s ~/siyuan-mcp/siyuan-plugin/dist ~/SiYuan/data/plugins/siyuan-plugin-mcp
```

**方法 2：手动复制**

复制 `dist/` 目录到：
- Windows: `C:\SiYuan\data\plugins\siyuan-plugin-mcp`
- macOS: `~/Library/Application Support/SiYuan/data/plugins/siyuan-plugin-mcp`
- Linux: `~/.config/SiYuan/data/plugins/siyuan-plugin-mcp`

### 3.3 重载插件

1. 打开思源笔记
2. 点击 **集市** → **已下载** → **插件**
3. 点击 **重新加载**

或者重启思源笔记。

## 第四步：配置插件

### 4.1 打开插件设置

1. 顶栏点击 ⚙️ 图标
2. 或者使用命令面板搜索 "MCP 插件设置"

### 4.2 配置 MCP 服务器

在设置中填写：

- **MCP 服务器地址**: `http://127.0.0.1:3000`
- **API Token**: （如果配置了的话）
- **启动时自动连接**: ✅

点击 **保存**。

## 第五步：测试功能

### 5.1 测试 AI 对话

1. 点击顶栏 🤖 图标
2. 输入消息："搜索我的笔记"
3. 查看 AI 响应

### 5.2 测试块级操作

1. 在编辑器中选择一个块
2. 右键点击
3. 选择以下任一操作：
   - **AI 总结**
   - **AI 续写**
   - **AI 改进**

## 故障排除

### 问题 1：无法连接到思源 API

**症状**: MCP 服务器启动失败

**解决方案**:
1. 确认思源笔记正在运行
2. 检查 `SIYUAN_API_URL` 是否正确
3. 检查防火墙设置

### 问题 2：插件未加载

**症状**: 顶栏没有 AI 图标

**解决方案**:
1. 打开思源控制台（帮助 → 开发者工具）
2. 查看是否有错误信息
3. 检查插件目录路径是否正确
4. 重启思源笔记

### 问题 3：MCP 服务器连接失败

**症状**: 插件显示"MCP 服务器无法访问"

**解决方案**:
1. 确认 MCP 服务器正在运行
2. 检查插件设置中的服务器地址
3. 测试 `curl http://127.0.0.1:3000/health`

## 下一步

恭喜！你已经成功安装了思源 MCP。

接下来可以：
- 📖 阅读 [使用示例](./EXAMPLES.md)
- 🔧 查看 [配置指南](../mcp-server/CONFIG.md)
- 🧪 尝试 [高级功能](./ADVANCED.md)
- 💡 提交 [反馈和建议](https://github.com/guozao-ex/siyuan-mcp/issues)

## 需要帮助？

- [常见问题](../README.md#常见问题)
- [GitHub Issues](https://github.com/guozao-ex/siyuan-mcp/issues)
- [开发文档](../DEVELOPMENT.md)
