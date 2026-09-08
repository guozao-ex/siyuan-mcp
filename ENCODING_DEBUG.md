# 中文编码问题诊断

## 问题现象
- curl 命令行显示中文为乱码
- 通过 MCP 服务器创建的文档标题和内容显示为乱码字符

## 已测试的方案

### 1. 直接调用思源 API（成功）
```bash
curl -X POST http://127.0.0.1:6806/api/filetree/createDocWithMd \
  -H "Content-Type: application/json" \
  -d '{"notebook":"xxx","path":"/测试.md","markdown":"# 中文"}'
```
结果：返回正常，文档ID创建成功

### 2. Node.js 内部编码测试（正常）
```javascript
const data = {path: '/测试.md', message: '创建成功: 测试'};
console.log(JSON.stringify(data));
// 输出: {"path":"/测试.md","message":"创建成功: 测试"}
```

### 3. 通过 MCP 服务器创建（显示乱码）
```bash
curl -X POST http://127.0.0.1:3000/create \
  -H "Content-Type: application/json" \
  -d '{"notebook":"xxx","path":"/中文.md","title":"测试","content":"内容"}'
```
结果：响应中的中文显示为 `���` 或 `efbfbd`

## 可能的原因

### 1. Windows 终端编码问题（最可能）
- Git Bash 在 Windows 上可能默认使用 GBK
- curl 输出到终端时发生编码转换
- **需要验证**：在思源笔记中打开文档，检查内容是否正常

### 2. Express 响应编码问题
- 已尝试设置：`Content-Type: application/json; charset=utf-8`
- Express 默认使用 UTF-8
- **可能需要**：在响应前确保 Buffer 编码正确

### 3. fetch API 请求编码问题
- Node.js fetch 默认使用 UTF-8
- JSON.stringify 应该正确处理 Unicode
- **需要验证**：中间环节是否有编码损失

## 下一步诊断

请在思源笔记中检查以下文档：

### 方法 1：通过文档列表查找
1. 打开思源笔记
2. 在左侧文档树中找到 "7.3寸六色墨水屏方案" 笔记本
3. 查找以下文档：
   - `Final-Chinese-Test.md`
   - `test-chinese-4.md`
   - `MCP-Project-Plan-Test.md`（英文对照）

### 方法 2：通过搜索
1. 在思源笔记中搜索："MCP服务器自动创建"
2. 或搜索："Final-Chinese-Test"

### 检查要点

**如果文档中的中文显示正常**：
- ✅ 说明 MCP 服务器功能正常
- ✅ 问题仅在于终端显示
- ✅ 可以继续使用，乱码只是视觉问题

**如果文档中也是乱码**：
- ❌ 需要修复编码问题
- 可能的修复方向：
  1. 在 fetch 请求时显式设置编码
  2. 使用 Buffer.from(string, 'utf-8')
  3. 检查思源 API 的编码要求

## 临时解决方案

在确认真实问题之前，可以：
1. 使用英文创建文档（已验证正常）
2. 创建后在思源中手动编辑添加中文
3. 或使用思源插件（直接在思源内部操作，避免编码转换）

## 待反馈信息

请告诉我：
1. ⬜ 思源笔记中这些文档的标题是否显示正常？
2. ⬜ 文档内容中的中文是否显示正常？
3. ⬜ 文档路径在文件树中显示是否正常？

根据您的反馈，我会提供相应的解决方案。
