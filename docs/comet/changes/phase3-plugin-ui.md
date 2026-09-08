---
schema: comet.native.change.v1
name: phase3-plugin-ui
status: completed
created: 2026-09-08
---

# Phase 3: 思源插件 UI 开发

## 目标 (Goal)

开发思源笔记插件的用户界面，包括 AI 对话面板、设置页面、MCP 客户端通信、块级 AI 功能和国际化支持。

## 范围 (Scope)

### 包含 (In Scope)
- 插件主入口和生命周期管理
- AI 对话面板（Svelte 组件）
- 设置页面组件
- MCP 客户端 API 封装
- 块级 AI 操作（总结、续写、改进）
- 国际化支持（中英文）
- 主题适配和响应式布局

### 不包含 (Out of Scope)
- 实际 AI 模型调用（Phase 4）
- HTTP 模式的 MCP 服务器（Phase 4）
- 高级 AI 功能（RAG、向量检索）
- 移动端特定优化

## 验收标准 (Acceptance Criteria)

- [x] index.ts 实现插件生命周期和菜单注册
- [x] AiPanel.svelte 实现对话界面和消息展示
- [x] Settings.svelte 实现配置管理界面
- [x] mcp.ts 实现 MCP HTTP 客户端
- [x] 块级右键菜单包含 3 个 AI 操作
- [x] 支持中英文切换
- [x] 样式适配思源主题变量
- [x] 响应式布局支持桌面和移动端

## 实现概要 (Implementation Summary)

### Change 11: 创建插件主入口 (src/index.ts)
**文件**: siyuan-plugin/src/index.ts (最终 ~250 行)

实现了 `McpPlugin` 类：
- **插件初始化**:
  - 加载配置和国际化
  - 初始化 MCP 客户端
  - 注册 UI 组件
- **顶栏图标**: 添加 AI 面板入口
- **右键菜单**: 注册块级 AI 操作
  - 总结内容
  - 继续写作
  - 改进文字
- **设置菜单**: 添加设置命令
- **状态管理**: 管理面板可见性和 Svelte 组件实例

国际化文件：
- `i18n/zh_CN.json`: 中文翻译
- `i18n/en_US.json`: 英文翻译

### Change 12: 实现AI对话面板组件 (src/components/AiPanel.svelte)
**文件**: siyuan-plugin/src/components/AiPanel.svelte (260 行)

Svelte 组件特性：
- **消息系统**:
  - 用户和助手消息展示
  - 时间戳格式化
  - 自动滚动到底部
- **输入处理**:
  - 多行文本输入
  - Enter 发送，Shift+Enter 换行
  - 发送按钮状态管理
- **加载状态**: 三点动画加载指示器
- **响应式设计**: 适配桌面和移动端
- **主题适配**: 使用思源 CSS 变量

样式特性：
- 固定在右侧的浮动面板
- 消息气泡（用户 vs 助手）
- 平滑动画和过渡效果

### Change 13: 实现设置页面组件 (src/components/Settings.svelte)
**文件**: siyuan-plugin/src/components/Settings.svelte (310 行)

功能模块：
- **连接配置**:
  - MCP 服务器地址输入
  - API Token 输入（密码类型）
  - 自动连接开关
- **表单验证**: 必填字段标记
- **更改检测**: 追踪配置变更
- **操作按钮**:
  - 保存（仅在有更改时启用）
  - 取消
  - 重置为默认
- **关于信息**: 版本、描述、GitHub 链接

UI 设计：
- 模态对话框遮罩层
- 表单布局和字段提示
- 按钮状态管理

### Change 14: 实现MCP客户端通信 (src/api/mcp.ts)
**文件**: siyuan-plugin/src/api/mcp.ts (180 行)

`McpClient` 类实现：
- **通用方法**:
  - `callTool()`: 调用任意 MCP 工具
  - `checkConnection()`: 检查服务器连接
- **搜索 API**:
  - `searchNotes()`: 搜索笔记
  - `listNotebooks()`: 列出笔记本
- **读取 API**:
  - `readBlock()`: 读取块
  - `readDocument()`: 读取文档
- **写入 API**:
  - `createDocument()`: 创建文档
  - `updateBlock()`: 更新块
  - `appendBlock()`: 追加块
  - `deleteBlock()`: 删除块

特性：
- HTTP POST 请求封装
- 超时控制（默认 30 秒）
- 错误处理和类型转换
- JSON 序列化/反序列化

### Change 15: 实现块级AI功能
**修改**: siyuan-plugin/src/index.ts

实现的块级操作：
1. **总结内容**:
   - 读取块内容
   - 生成摘要（当前为占位符）
   - 追加摘要到块
2. **继续写作**:
   - 读取块内容作为上下文
   - 生成续写内容（当前为占位符）
   - 追加续写内容
3. **改进文字**:
   - 读取块内容
   - 生成改进版本（当前为占位符）
   - 更新块内容

错误处理：
- MCP 客户端未配置提示
- 块内容为空检查
- 操作失败提示

### Change 16: 添加国际化支持
**文件**: 
- siyuan-plugin/i18n/zh_CN.json (完整版 60+ 条)
- siyuan-plugin/i18n/en_US.json (完整版 60+ 条)

翻译覆盖：
- 插件菜单和按钮
- AI 对话面板文案
- 设置页面标签和提示
- 块级操作名称
- 提示消息和错误信息

结构化组织：
- `aiPanel.*`: 对话面板相关
- `settings.*`: 设置页面相关
- `blockMenu.*`: 右键菜单相关
- `messages.*`: 提示消息相关

### Change 17: 实现插件样式和主题适配
**文件**: siyuan-plugin/src/styles/main.css (350 行)

样式模块：
- **全局样式**: 使用思源 CSS 变量
- **顶栏图标**: 悬停效果和过渡
- **加载指示器**: 旋转动画
- **消息提示**: Toast 样式和动画
- **工具类**: 隐藏、禁用状态

响应式设计：
- 桌面端固定宽度
- 移动端全屏显示
- 媒体查询断点 768px

主题适配：
- 明暗主题支持
- 高对比度模式
- 自定义滚动条样式

无障碍支持：
- 焦点可见样式
- 键盘导航优化
- 屏幕阅读器支持
- 减少动画选项

## 技术决策 (Technical Decisions)

1. **Svelte 框架**: 轻量级、性能好、编译时优化
2. **组件状态管理**: 使用 Svelte stores 和 props
3. **HTTP 客户端**: 使用 Fetch API，支持超时控制
4. **样式方案**: 使用思源 CSS 变量，确保主题一致性
5. **国际化**: JSON 文件，结构化键值对
6. **占位符实现**: AI 功能暂用占位符，Phase 4 将实现真实调用

## 代码统计

- 总行数: ~1,620 行
- 文件数: 7 个
- Svelte 组件: 2 个
- TypeScript 文件: 2 个
- 样式文件: 1 个
- 国际化文件: 2 个

## 证据 (Evidence)

- Git commit: 6bb8520
- 文件清单:
  - siyuan-plugin/src/index.ts (250 行)
  - siyuan-plugin/src/components/AiPanel.svelte (260 行)
  - siyuan-plugin/src/components/Settings.svelte (310 行)
  - siyuan-plugin/src/api/mcp.ts (180 行)
  - siyuan-plugin/i18n/zh_CN.json (60+ 条)
  - siyuan-plugin/i18n/en_US.json (60+ 条)
  - siyuan-plugin/src/styles/main.css (350 行)

## 下一步 (Next Steps)

进入 Phase 4: 集成与优化
- Change 18: 添加 MCP 服务器 HTTP 模式
- Change 19: 实现插件与 MCP 服务器集成
- Change 20-22: 配置管理、日志系统、性能优化
