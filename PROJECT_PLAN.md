# 思源笔记通用MCP项目开发计划

## 项目概述
开发一个通用的思源笔记MCP服务器和配套插件，支持所有MCP协议的AI Agent。

## Change拆分

### Phase 1: 项目初始化与基础设施 (4 changes)

#### Change 1: 创建项目结构和配置文件
- 创建根目录结构
- 创建 mcp-server 和 siyuan-plugin 子目录
- 添加 .gitignore
- 创建 README.md

#### Change 2: 初始化MCP服务器项目
- 初始化 package.json
- 配置 TypeScript (tsconfig.json)
- 安装基础依赖 (@modelcontextprotocol/sdk, typescript, tsx)
- 创建基础目录结构 (src/tools, src/siyuan, src/utils)

#### Change 3: 初始化思源插件项目
- 初始化 package.json
- 配置 TypeScript, Vite, Svelte
- 安装插件开发依赖
- 创建 plugin.json

#### Change 4: 配置开发工具和脚本
- 添加开发脚本 (dev, build, test)
- 配置 ESLint 和 Prettier
- 创建开发环境说明文档

---

### Phase 2: MCP服务器核心开发 (6 changes)

#### Change 5: 实现思源API类型定义
- 创建 src/siyuan/types.ts
- 定义所有API响应类型
- 定义笔记本、块、文档等数据结构

#### Change 6: 实现思源API客户端
- 创建 src/siyuan/api.ts
- 实现通用请求方法
- 实现基础API调用 (listNotebooks, getVersion)

#### Change 7: 实现笔记搜索功能
- 实现 searchBlocks API
- 创建 src/tools/search.ts
- 实现搜索结果格式化

#### Change 8: 实现笔记读取功能
- 实现 getBlockKramdown API
- 创建 src/tools/read.ts
- 实现内容格式转换

#### Change 9: 实现笔记写入功能
- 实现 createDocument, updateBlock, appendBlock API
- 创建 src/tools/write.ts
- 实现写入操作和错误处理

#### Change 10: 实现MCP服务器主程序
- 创建 src/index.ts
- 注册所有MCP工具
- 实现工具调用路由
- 添加错误处理和日志

---

### Phase 3: 思源插件UI开发 (7 changes)

#### Change 11: 创建插件主入口
- 实现 src/index.ts 插件类
- 添加插件生命周期钩子
- 注册顶栏图标

#### Change 12: 实现AI对话面板组件
- 创建 src/components/AiPanel.svelte
- 实现消息列表显示
- 实现输入框和发送功能

#### Change 13: 实现设置页面组件
- 创建 src/components/Settings.svelte
- 实现配置表单
- 实现配置保存和加载

#### Change 14: 实现MCP客户端通信
- 创建 src/api/mcp.ts
- 实现HTTP调用MCP服务器
- 实现错误处理

#### Change 15: 实现块级AI功能
- 注册右键菜单
- 实现"总结内容"功能
- 实现"继续写作"功能
- 实现"改进文字"功能

#### Change 16: 添加国际化支持
- 创建 i18n/zh_CN.json
- 创建 i18n/en_US.json
- 在组件中使用国际化

#### Change 17: 实现插件样式和主题适配
- 创建 src/styles/main.css
- 适配思源主题变量
- 实现响应式布局

---

### Phase 4: 集成与优化 (5 changes)

#### Change 18: 添加MCP服务器HTTP模式
- 在MCP服务器添加HTTP服务器
- 实现CORS配置
- 实现工具HTTP端点

#### Change 19: 实现插件与MCP服务器集成
- 在插件中调用MCP服务器
- 实现AI对话功能
- 添加加载状态和错误提示

#### Change 20: 添加配置管理
- 实现配置文件读写
- 添加环境变量支持
- 创建配置示例文件

#### Change 21: 添加日志和调试功能
- 实现日志系统
- 添加调试模式
- 创建调试工具

#### Change 22: 性能优化
- 实现请求缓存
- 优化大文档处理
- 添加请求限流

---

### Phase 5: 测试与文档 (4 changes)

#### Change 23: 添加MCP服务器单元测试
- 创建测试框架
- 编写API客户端测试
- 编写工具函数测试

#### Change 24: 添加集成测试
- 创建测试环境
- 编写端到端测试
- 添加测试脚本

#### Change 25: 完善使用文档
- 创建安装指南
- 创建配置指南
- 添加常见问题解答
- 创建API文档

#### Change 26: 添加示例和教程
- 创建快速开始示例
- 添加使用场景演示
- 创建视频教程脚本

---

### Phase 6: 发布准备 (3 changes)

#### Change 27: 准备发布资源
- 创建插件图标
- 创建预览图
- 准备发布说明

#### Change 28: 配置CI/CD
- 添加GitHub Actions工作流
- 配置自动化测试
- 配置自动化发布

#### Change 29: 发布到社区
- 发布npm包
- 提交到思源集市
- 创建发布公告

---

## 总计
**29个Changes**，分为6个开发阶段

## 预估时间
- Phase 1: 2-3天
- Phase 2: 5-7天
- Phase 3: 5-7天
- Phase 4: 3-5天
- Phase 5: 3-4天
- Phase 6: 2-3天

**总计: 20-29天**（全职开发）

对于初学者，建议每个阶段预留更多时间进行学习和调试。
