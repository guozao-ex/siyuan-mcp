# 完整测试指南

本文档提供思源 MCP 项目的完整测试步骤。

## 测试类型

1. **单元测试** - 测试独立功能模块（不需要思源运行）
2. **集成测试** - 测试与思源 API 的交互（需要思源运行）
3. **E2E 测试** - 测试完整的 HTTP 服务器（需要思源运行）
4. **手动测试** - 测试插件 UI 和用户功能

---

## 准备工作

### 1. 安装依赖

```bash
# 安装 MCP 服务器依赖
cd mcp-server
npm install

# 安装插件依赖
cd ../siyuan-plugin
npm install
```

### 2. 启动思源笔记

确保思源笔记正在运行：
- 默认 API 地址：`http://127.0.0.1:6806`
- 如果修改了端口，需要在配置中更新

---

## 测试 1: 单元测试（推荐先做）

单元测试不需要思源运行，测试代码逻辑。

### 运行所有单元测试

```bash
cd mcp-server
npm test
```

### 运行特定测试

```bash
# 测试缓存功能
npm test -- tests/cache.test.ts

# 测试搜索功能
npm test -- tests/search.test.ts

# 测试 API 客户端
npm test -- tests/api.test.ts
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

报告会生成在 `coverage/` 目录。

### 预期结果

✅ 所有测试通过
✅ 覆盖率 > 70%

---

## 测试 2: MCP 服务器功能测试

测试 MCP 服务器是否能正常启动和响应。

### 步骤 1: 配置环境

创建 `.env` 文件：

```bash
cd mcp-server
cp .env.example .env
```

编辑 `.env`：

```bash
SIYUAN_API_URL=http://127.0.0.1:6806
SIYUAN_API_TOKEN=         # 如果启用了认证则填写
MCP_TRANSPORT=http
MCP_PORT=3000
```

### 步骤 2: 启动服务器

```bash
npm run dev
```

预期输出：

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

### 步骤 3: 测试 HTTP 端点

打开新终端，运行以下测试：

#### 3.1 健康检查

```bash
curl http://127.0.0.1:3000/health
```

预期响应：
```json
{"status":"ok","timestamp":1234567890}
```

#### 3.2 列出工具

```bash
curl http://127.0.0.1:3000/tools
```

预期响应：
```json
{"tools":["search_notes","list_notebooks","read_block",...]}
```

#### 3.3 列出笔记本

```bash
curl -X POST http://127.0.0.1:3000/notebooks -H "Content-Type: application/json"
```

预期响应：包含你的笔记本列表

#### 3.4 搜索笔记

```bash
curl -X POST http://127.0.0.1:3000/search \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"test\",\"pageSize\":3}"
```

预期响应：包含搜索结果

### 预期结果

✅ 服务器成功启动
✅ 所有端点返回正确响应
✅ 日志显示请求和响应信息

---

## 测试 3: 集成测试

集成测试需要真实的思源实例。

### 步骤 1: 设置环境变量

```bash
cd mcp-server
export RUN_INTEGRATION_TESTS=true
export SIYUAN_API_URL=http://127.0.0.1:6806
# Windows 使用 set 而不是 export
```

### 步骤 2: 运行集成测试

```bash
npm test -- tests/integration.test.ts
```

### 预期结果

✅ 所有 API 调用成功
✅ 缓存机制正常工作

---

## 测试 4: E2E 测试

测试完整的 HTTP 服务器功能。

### 步骤 1: 启动 MCP 服务器

```bash
cd mcp-server
npm run dev
```

保持运行。

### 步骤 2: 新终端运行 E2E 测试

```bash
cd mcp-server
export RUN_E2E_TESTS=true
npm test -- tests/e2e.test.ts
```

### 预期结果

✅ 健康检查通过
✅ 工具调用成功
✅ CORS 配置正确
✅ 速率限制生效

---

## 测试 5: 思源插件测试

测试插件在思源笔记中的表现。

### 步骤 1: 构建插件

```bash
cd siyuan-plugin
npm run build
```

### 步骤 2: 安装插件到思源

**Windows 符号链接：**
```bash
mklink /D "C:\SiYuan\data\plugins\siyuan-plugin-mcp" "D:\DEV\siyuan\siyuan-plugin\dist"
```

**或手动复制：**
复制 `dist/` 目录到思源的 `data/plugins/siyuan-plugin-mcp`

### 步骤 3: 重载插件

1. 打开思源笔记
2. 设置 → 集市 → 已下载 → 插件 → 重新加载
3. 或重启思源

### 步骤 4: 检查插件加载

打开开发者工具（帮助 → 开发者工具），查看 Console：

预期输出：
```
MCP Plugin loaded
```

### 步骤 5: 配置插件

1. 点击顶栏设置图标（或搜索"MCP 插件设置"）
2. 填写：
   - MCP 服务器地址: `http://127.0.0.1:3000`
   - 勾选"启动时自动连接"
3. 点击保存

预期提示：
```
MCP 服务器已连接
设置已保存
```

### 步骤 6: 测试 AI 对话

1. 点击顶栏 AI 图标（🤖）
2. 应该出现对话面板
3. 输入消息："搜索我的笔记"
4. 查看响应

预期：返回带有搜索上下文的响应

### 步骤 7: 测试块级操作

1. 在编辑器中创建或选择一个块
2. 右键点击块
3. 查看菜单中是否有：
   - AI 总结
   - AI 续写
   - AI 改进
4. 点击"AI 总结"

预期：
- 显示"处理中..."
- 在块后追加摘要内容

---

## 常见问题排查

### 问题 1: 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 问题 2: MCP 服务器无法连接思源

**检查清单：**
- [ ] 思源笔记是否运行？
- [ ] API 地址是否正确？（`http://127.0.0.1:6806`）
- [ ] 防火墙是否阻止？
- [ ] API Token 是否正确？（如果启用了认证）

**验证方法：**
```bash
curl http://127.0.0.1:6806/api/system/version
```

### 问题 3: 插件未加载

**检查清单：**
- [ ] 插件目录路径正确？
- [ ] 构建成功？（检查 `dist/` 目录）
- [ ] `plugin.json` 存在？
- [ ] 思源版本 >= 2.9.0？

**查看日志：**
开发者工具 → Console，查找错误信息

### 问题 4: 测试超时

```bash
# 增加超时时间
npm test -- --testTimeout=10000
```

### 问题 5: 端口被占用

```bash
# 修改端口
export MCP_PORT=3001
npm run dev
```

---

## 测试检查清单

在提交代码前，确保：

- [ ] 单元测试全部通过
- [ ] MCP 服务器可以启动
- [ ] HTTP 端点返回正确响应
- [ ] 插件可以加载
- [ ] 插件可以连接 MCP 服务器
- [ ] AI 对话面板可以打开
- [ ] 块级操作菜单可见
- [ ] 没有控制台错误

---

## 性能测试（可选）

### 测试速率限制

```bash
# 快速发送 65 个请求
for i in {1..65}; do
  curl http://127.0.0.1:3000/health &
done
wait
```

预期：部分请求返回 429 状态码

### 测试缓存效果

```bash
# 第一次请求（较慢）
time curl -X POST http://127.0.0.1:3000/notebooks

# 第二次请求（应该更快）
time curl -X POST http://127.0.0.1:3000/notebooks
```

---

## 自动化测试脚本

创建 `test-all.sh`（Linux/Mac）或 `test-all.bat`（Windows）：

```bash
#!/bin/bash
set -e

echo "=== 运行单元测试 ==="
cd mcp-server
npm test -- --run

echo "=== 启动 MCP 服务器 ==="
npm run dev &
SERVER_PID=$!
sleep 5

echo "=== 测试 HTTP 端点 ==="
curl -f http://127.0.0.1:3000/health
curl -f -X POST http://127.0.0.1:3000/notebooks

echo "=== 停止服务器 ==="
kill $SERVER_PID

echo "=== 所有测试通过！ ==="
```

---

## 获取帮助

- 查看日志文件
- 检查 GitHub Issues
- 阅读完整文档：`docs/` 目录
- 提交新 Issue：https://github.com/guozao-ex/siyuan-mcp/issues
