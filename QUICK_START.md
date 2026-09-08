# 快速启动脚本

## 第一步：安装依赖

### 1. 安装 MCP 服务器依赖
```bash
cd d:\DEV\siyuan\mcp-server
npm install
```
这会安装约 50-100 个包，需要 1-2 分钟。

### 2. 安装插件依赖
```bash
cd d:\DEV\siyuan\siyuan-plugin
npm install
```

---

## 第二步：启动思源笔记

1. 打开思源笔记应用
2. 确认运行在默认端口 6806
3. 验证：浏览器访问 http://127.0.0.1:6806

---

## 第三步：配置 MCP 服务器

### 1. 创建配置文件
```bash
cd d:\DEV\siyuan\mcp-server
copy .env.example .env
```

### 2. 编辑 .env 文件
```bash
notepad .env
```

最小配置（无需 API Token）：
```
SIYUAN_API_URL=http://127.0.0.1:6806
MCP_TRANSPORT=http
MCP_PORT=3000
```

---

## 第四步：启动 MCP 服务器

```bash
cd d:\DEV\siyuan\mcp-server
npm run dev
```

**成功标志：**
```
==================================================
MCP Server Configuration
==================================================
SiYuan API URL: http://127.0.0.1:6806
Transport Mode: http
HTTP Server: http://127.0.0.1:3000
==================================================
[INFO] Connected to SiYuan version 2.9.0
[INFO] HTTP server listening on http://127.0.0.1:3000
```

保持这个终端窗口运行！

---

## 第五步：测试 MCP 服务器（新开终端）

```bash
# 测试 1：健康检查
curl http://127.0.0.1:3000/health

# 测试 2：列出笔记本
curl -X POST http://127.0.0.1:3000/notebooks -H "Content-Type: application/json"
```

---

## 第六步：构建思源插件（可选）

```bash
cd d:\DEV\siyuan\siyuan-plugin
npm run build
```

构建完成后，`dist/` 目录包含插件文件。

---

## 第七步：安装插件到思源（可选）

### 方法 1：符号链接（推荐开发）
```bash
# 以管理员身份运行 PowerShell
mklink /D "C:\SiYuan\data\plugins\siyuan-plugin-mcp" "D:\DEV\siyuan\siyuan-plugin\dist"
```

### 方法 2：手动复制
复制 `dist/` 目录到思源的 `data/plugins/siyuan-plugin-mcp`

然后在思源中：设置 → 集市 → 已下载 → 插件 → 重新加载

---

## 常见问题

### Q1: 思源在哪里？
答：查找思源笔记的安装位置，通常在：
- `C:\Program Files\SiYuan\`
- `C:\Users\YourName\AppData\Local\Programs\SiYuan\`

### Q2: 如何获取 API Token？
答：思源笔记 → 设置 → 关于 → API Token
（如果未启用认证，可以不填）

### Q3: 端口被占用怎么办？
答：修改 .env 中的 MCP_PORT=3001

### Q4: npm install 很慢？
答：使用国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
```

---

## 架构图

```
┌─────────────────┐
│   Claude AI     │
│  (或其他 Agent)  │
└────────┬────────┘
         │ MCP Protocol
         │
┌────────▼────────┐
│  MCP 服务器      │ ← 独立运行，端口 3000
│  (HTTP/stdio)   │
└────────┬────────┘
         │ 思源 API
         │
┌────────▼────────┐
│   思源笔记       │ ← 端口 6806
│  + 思源插件      │
└─────────────────┘
```

---

## 使用场景

### 场景 1：只用 MCP 服务器（推荐先测试）
1. 启动思源笔记
2. 启动 MCP 服务器
3. 用 curl 或其他工具调用 API
4. 可以集成到 Claude Desktop

### 场景 2：完整功能（需要插件）
1. 启动思源笔记
2. 启动 MCP 服务器
3. 安装思源插件
4. 在思源内使用 AI 对话和块级操作

---

## 下一步

1. 按顺序执行上述步骤
2. 如遇到问题，查看错误信息
3. 参考完整文档：docs/TESTING_GUIDE.md
