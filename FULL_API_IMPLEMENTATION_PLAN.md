# 完整 API 实现计划

## 目标
实现剩余的 55 个思源笔记 API，达到 75/75 (100%) 完成度

## 实施策略

### 分批实现（按优先级）

#### 第一批：高优先级 API（⭐⭐⭐）- 10 个
预计时间：2-3 小时

1. `/api/asset/upload` - 上传资源文件
2. `/api/export/exportMdContent` - 导出 Markdown
3. `/api/import/importStdMd` - 导入 Markdown  
4. `/api/notebook/createNotebook` - 创建笔记本
5. `/api/filetree/moveDocs` - 移动文档
6. `/api/ref/getBacklink` - 获取反向链接
7. `/api/block/getChildBlocks` - 获取子块
8. `/api/outline/getDocOutline` - 获取大纲
9. `/api/filetree/listDocsByPath` - 列出目录文档
10. `/api/tag/getTags` - 获取标签

#### 第二批：中优先级 API（⭐⭐）- 25 个
预计时间：4-5 小时

**资源文件管理：**
11. `/api/asset/insertLocalAssets` - 插入本地资源
12. `/api/asset/resolveAssetPath` - 解析资源路径

**模板功能：**
13. `/api/template/render` - 渲染模板
14. `/api/template/docSaveAsTemplate` - 文档保存为模板

**导出功能：**
15. `/api/export/exportHTML` - 导出 HTML
16. `/api/export/exportResources` - 导出包含资源
17. `/api/export/batchExportMd` - 批量导出 Markdown
18. `/api/export/exportPDF` - 导出 PDF

**导入功能：**
19. `/api/import/importData` - 导入数据
20. `/api/import/importNotebook` - 导入笔记本

**笔记本操作：**
21. `/api/notebook/closeNotebook` - 关闭笔记本
22. `/api/notebook/removeNotebook` - 删除笔记本
23. `/api/notebook/renameNotebook` - 重命名笔记本

**文件树操作：**
24. `/api/filetree/getHPathByID` - 通过 ID 获取路径
25. `/api/filetree/searchDocs` - 搜索文档

**引用反链：**
26. `/api/ref/getBacklink2` - 获取反向链接2
27. `/api/ref/getBackmention` - 获取反向提及

**历史版本：**
28. `/api/history/getDocHistoryContent` - 获取文档历史
29. `/api/history/rollbackDocHistory` - 回滚文档历史

**快照功能：**
30. `/api/snapshot/createSnapshot` - 创建快照
31. `/api/snapshot/rollbackSnapshot` - 回滚快照

**其他：**
32. `/api/outline/getDocOutline` - 获取文档大纲
33. `/api/block/getChildBlocks` - 获取子块
34. `/api/tag/getTags` - 获取标签
35. `/api/filetree/listDocsByPath` - 列出目录

#### 第三批：低优先级 API（⭐）- 20 个
预计时间：3-4 小时

**资源文件：**
36. `/api/asset/getUnusedAssets` - 获取未使用资源
37. `/api/asset/removeUnusedAssets` - 删除未使用资源

**模板：**
38. `/api/template/renderSprig` - 渲染 Sprig 模板
39. `/api/template/renderTemplate` - 渲染模板内容

**导出：**
40. `/api/export/exportDocx` - 导出 Word 文档

**导入：**
41. `/api/import/importSY` - 导入思源数据

**文件树：**
42. `/api/filetree/getHPathByPath` - 获取可读路径

**标签书签：**
43. `/api/bookmark/getBookmark` - 获取书签
44. `/api/bookmark/renameBookmark` - 重命名书签

**历史：**
45. `/api/history/getNotebookHistory` - 获取笔记本历史
46. `/api/history/clearWorkspaceHistory` - 清理历史记录

**快照：**
47. `/api/snapshot/removeSnapshot` - 删除快照

**同步：**
48. `/api/sync/performSync` - 执行同步
49. `/api/sync/getSyncStatus` - 获取同步状态
50. `/api/sync/createCloudSnapshot` - 创建云端快照

**其他：**
51. `/api/inbox/getShorthand` - 获取速记
52. `/api/notification/pushMsg` - 推送消息
53. `/api/notification/pushErrMsg` - 推送错误消息
54. `/api/riff/getRiffDueCards` - 获取待复习卡片
55. `/api/block/getBlockBreadcrumb` - 获取块面包屑
56. `/api/block/transferBlockRef` - 转换块引用

---

## 实施步骤

### 步骤 1: 更新类型定义
- 在 `types.ts` 中添加所有新 API 的请求/响应类型

### 步骤 2: 实现 API 方法
- 在 `api.ts` 中添加所有新方法

### 步骤 3: 创建 MCP 工具
- 在 `tools/` 目录下创建新工具文件
- 或扩展现有工具文件

### 步骤 4: 注册工具
- 在 `index.ts` 中注册新工具

### 步骤 5: 测试
- 编写测试用例
- 验证所有功能

### 步骤 6: 文档
- 更新 API 文档
- 更新使用示例

---

## 预计总时间
- 第一批：2-3 小时
- 第二批：4-5 小时  
- 第三批：3-4 小时
- 测试和文档：2-3 小时

**总计：11-15 小时（约 2 个工作日）**

---

## 开始实施

准备好了吗？我将按以下顺序开始：

1. ✅ 先实现第一批（10 个高优先级 API）
2. ⏸️ 测试第一批
3. ⏸️ 实现第二批（25 个中优先级 API）
4. ⏸️ 测试第二批
5. ⏸️ 实现第三批（20 个低优先级 API）
6. ⏸️ 完整测试
7. ⏸️ 更新文档

**现在开始第一批实现！**
