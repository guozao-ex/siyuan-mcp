---
schema: comet.native.change.v1
name: phase2-mcp-server-core
status: completed
created: 2026-09-08
---

# Phase 2: MCP 服务器核心开发

## 目标 (Goal)

实现 MCP 服务器的核心功能，包括思源 API 封装、MCP 工具实现和服务器主程序。

## 范围 (Scope)

### 包含 (In Scope)
- 完整的 TypeScript 类型定义（所有思源 API 类型）
- 思源 API 客户端（HTTP 请求封装）
- 搜索工具（搜索笔记、列出笔记本）
- 读取工具（读取块、读取文档）
- 写入工具（创建、更新、追加、删除）
- MCP 服务器主程序（stdio 传输）

### 不包含 (Out of Scope)
- HTTP 传输模式（Phase 4）
- 缓存机制（Phase 4）
- 单元测试（Phase 5）
- 性能优化（Phase 4）

## 验收标准 (Acceptance Criteria)

- [x] types.ts 包含所有必要的 API 类型定义
- [x] api.ts 实现通用请求方法和所有核心 API
- [x] search.ts 实现搜索和列出笔记本功能
- [x] read.ts 实现块和文档读取功能
- [x] write.ts 实现创建、更新、删除功能
- [x] index.ts 实现 MCP 服务器主程序
- [x] 所有代码包含完整的 TypeScript 类型注解
- [x] 包含错误处理和输入验证
- [x] 代码符合 ESLint 规范

## 实现概要 (Implementation Summary)

### Change 5: 实现思源API类型定义 (src/siyuan/types.ts)
**文件**: mcp-server/src/siyuan/types.ts (360 行)

定义了完整的类型系统：
- `BaseResponse<T>`: 通用 API 响应接口
- `Block`: 块数据结构（包含 id, type, content, markdown 等 20+ 字段）
- `BlockType` 和 `BlockSubType`: 块类型枚举
- `Notebook`: 笔记本数据结构
- `SearchBlocksRequest/Response`: 搜索请求和响应
- `GetBlockKramdownRequest/Response`: 获取块内容
- `InsertBlockRequest/Response`: 插入块操作
- `UpdateBlockRequest/Response`: 更新块操作
- `CreateDocWithMdRequest/Response`: 创建文档
- `SqlQueryRequest/Response`: SQL 查询
- `SiYuanApiError`: 自定义错误类

### Change 6: 实现思源API客户端 (src/siyuan/api.ts)
**文件**: mcp-server/src/siyuan/api.ts (280 行)

实现了 `SiYuanClient` 类：
- 构造函数：支持环境变量配置（SIYUAN_API_URL, SIYUAN_API_TOKEN）
- `request<T>()`: 通用 HTTP POST 请求方法，包含错误处理
- 系统 API: `getVersion()`, `getBootProgress()`
- 笔记本 API: `listNotebooks()`
- 搜索 API: `searchBlocks()`, `searchByKeyword()`
- 块 API: `getBlockKramdown()`, `getBlockAttrs()`, `insertBlock()`, `updateBlock()`, `deleteBlock()`, `appendBlock()`, `prependBlock()`
- 文档 API: `createDocWithMd()`, `getDocInfo()`, `renameDoc()`, `removeDoc()`, `getDocChildBlocks()`
- SQL API: `sql()`
- 辅助方法: `checkConnection()`, `getConnectionStatus()`

### Change 7: 实现笔记搜索功能 (src/tools/search.ts)
**文件**: mcp-server/src/tools/search.ts (180 行)

实现了 3 个搜索相关函数：
- `searchNotes()`: 简单关键词搜索，返回格式化的搜索结果
- `searchBlocks()`: 高级搜索，支持类型过滤、方法选择（keyword/querySyntax/sql/regex）
- `listNotebooks()`: 列出所有笔记本

辅助函数：
- `getBlockTypeLabel()`: 将块类型代码转换为可读标签
- `formatBlockContent()`: 格式化块内容（移除 HTML、限制长度）
- `formatSearchResults()`: 格式化搜索结果为文本

### Change 8: 实现笔记读取功能 (src/tools/read.ts)
**文件**: mcp-server/src/tools/read.ts (230 行)

实现了 4 个读取相关函数：
- `readBlock()`: 读取单个块，支持包含属性
- `readDocument()`: 读取完整文档，支持包含所有子块
- `readBlocks()`: 批量读取多个块
- `readByPath()`: 根据路径搜索并读取块

辅助函数：
- `formatReadResult()`: 格式化读取结果为文本
- `extractPlainText()`: 从 markdown 提取纯文本

### Change 9: 实现笔记写入功能 (src/tools/write.ts)
**文件**: mcp-server/src/tools/write.ts (330 行)

实现了 8 个写入相关函数：
- `createDocument()`: 创建新文档
- `updateBlock()`: 更新块内容
- `appendBlock()`: 追加内容到块
- `insertBlockBefore()`: 在块前插入内容
- `insertBlockAfter()`: 在块后插入内容
- `deleteBlock()`: 删除块
- `renameDocument()`: 重命名文档
- `deleteDocument()`: 删除文档
- `appendToDocument()`: 追加内容到文档末尾

辅助函数：
- `validateNotebook()`: 验证笔记本存在
- `validateBlock()`: 验证块存在
- `formatWriteResult()`: 格式化写入结果
- `sanitizeMarkdown()`: 清理 markdown 内容（移除 script、iframe）
- `validateMarkdown()`: 验证 markdown 格式

### Change 10: 实现MCP服务器主程序 (src/index.ts)
**文件**: mcp-server/src/index.ts (280 行)

实现了完整的 MCP 服务器：
- 初始化 MCP Server 和 SiYuanClient
- 定义 8 个 MCP 工具：
  1. `search_notes`: 搜索笔记
  2. `list_notebooks`: 列出笔记本
  3. `read_block`: 读取块
  4. `read_document`: 读取文档
  5. `create_document`: 创建文档
  6. `update_block`: 更新块
  7. `append_block`: 追加块
  8. `delete_block`: 删除块
- 实现请求处理器：
  - `ListToolsRequestSchema`: 返回工具列表
  - `CallToolRequestSchema`: 执行工具调用
- 启动逻辑：
  - 检查 SiYuan 连接
  - 启动 stdio 传输
  - 错误处理和日志

## 技术决策 (Technical Decisions)

1. **类型优先**: 所有 API 都有完整的 TypeScript 类型定义，确保类型安全
2. **错误处理**: 使用自定义 `SiYuanApiError` 类，包含错误码和详细信息
3. **环境变量**: 支持通过环境变量配置 API URL 和 Token
4. **格式化输出**: 提供多种格式化函数，方便调试和展示
5. **内容安全**: 实现 markdown 清理和验证，防止注入攻击
6. **Stdio 传输**: 优先实现 stdio 模式，适配 Claude Desktop
7. **模块化设计**: 工具函数按功能分类（search/read/write）

## 代码统计

- 总行数: ~1,800 行
- 文件数: 6 个
- 类型定义: 30+ 个接口
- API 方法: 20+ 个
- MCP 工具: 8 个
- 辅助函数: 15+ 个

## 证据 (Evidence)

- Git commit: c0eb10c
- 文件清单:
  - mcp-server/src/siyuan/types.ts (360 行)
  - mcp-server/src/siyuan/api.ts (280 行)
  - mcp-server/src/tools/search.ts (180 行)
  - mcp-server/src/tools/read.ts (230 行)
  - mcp-server/src/tools/write.ts (330 行)
  - mcp-server/src/index.ts (280 行)

## 下一步 (Next Steps)

进入 Phase 3: 思源插件 UI 开发
- Change 11: 创建插件主入口
- Change 12: 实现 AI 对话面板组件
- Change 13-17: 实现设置、MCP 通信、块级功能、国际化、样式
