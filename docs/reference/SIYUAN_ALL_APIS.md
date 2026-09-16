# 思源笔记完整 API 列表

## 已实现的 API（20个）✅

### 一、文档管理 (5个)
| # | API 路径 | 功能 | 状态 |
|---|---------|------|------|
| 1 | `/api/filetree/createDocWithMd` | 创建文档（Markdown） | ✅ |
| 2 | `/api/filetree/renameDoc` | 重命名文档 | ✅ |
| 3 | `/api/filetree/removeDoc` | 删除文档 | ✅ |
| 4 | `/api/filetree/getDoc` | 获取文档内容 | ✅ |
| 5 | `/api/block/getDocInfo` | 获取文档元信息 | ✅ |

### 二、块操作 (7个)
| # | API 路径 | 功能 | 状态 |
|---|---------|------|------|
| 6 | `/api/block/getBlockKramdown` | 获取块的 Kramdown 内容 | ✅ |
| 7 | `/api/block/insertBlock` | 插入新块 | ✅ |
| 8 | `/api/block/updateBlock` | 更新块内容 | ✅ |
| 9 | `/api/block/deleteBlock` | 删除块 | ✅ |
| 10 | `/api/block/getBlockAttrs` | 获取块属性 | ✅ |
| 11 | `/api/attr/setBlockAttrs` | 设置块属性 | ✅ |
| 12 | `/api/block/prependBlock` | 在前面插入块 | ✅ |

### 三、搜索查询 (3个)
| # | API 路径 | 功能 | 状态 |
|---|---------|------|------|
| 13 | `/api/query/sql` | SQL 查询 | ✅ |
| 14 | `/api/search/searchBlock` | 搜索块 | ✅ (用 SQL 实现) |
| 15 | `/api/search/fullTextSearchBlock` | 全文搜索 | ✅ (用 SQL 实现) |

### 四、笔记本管理 (2个)
| # | API 路径 | 功能 | 状态 |
|---|---------|------|------|
| 16 | `/api/notebook/lsNotebooks` | 列出所有笔记本 | ✅ |
| 17 | `/api/notebook/openNotebook` | 打开笔记本 | ✅ |

### 五、系统功能 (3个)
| # | API 路径 | 功能 | 状态 |
|---|---------|------|------|
| 18 | `/api/system/version` | 获取思源版本 | ✅ |
| 19 | `/api/system/bootProgress` | 获取启动进度 | ✅ |
| 20 | `/api/system/getConf` | 获取系统配置 | ✅ |

---

## 未实现的 API（42个）❌

### 六、资源文件管理 (5个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 21 | `/api/asset/upload` | 上传资源文件 | ⭐⭐⭐ | 图片、附件上传 |
| 22 | `/api/asset/insertLocalAssets` | 插入本地资源 | ⭐⭐ | 批量插入资源 |
| 23 | `/api/asset/resolveAssetPath` | 解析资源路径 | ⭐ | 获取资源实际路径 |
| 24 | `/api/asset/getUnusedAssets` | 获取未使用资源 | ⭐ | 清理未使用资源 |
| 25 | `/api/asset/removeUnusedAssets` | 删除未使用资源 | ⭐ | 批量清理 |

### 七、模板功能 (4个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 26 | `/api/template/render` | 渲染模板 | ⭐⭐ | 应用模板到文档 |
| 27 | `/api/template/docSaveAsTemplate` | 文档保存为模板 | ⭐ | 创建自定义模板 |
| 28 | `/api/template/renderSprig` | 渲染 Sprig 模板 | ⭐ | Go 模板引擎 |
| 29 | `/api/template/renderTemplate` | 渲染模板内容 | ⭐ | 模板变量替换 |

### 八、导出功能 (6个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 30 | `/api/export/exportMdContent` | 导出 Markdown 内容 | ⭐⭐⭐ | 常用导出功能 |
| 31 | `/api/export/exportHTML` | 导出 HTML | ⭐⭐ | 网页格式导出 |
| 32 | `/api/export/exportResources` | 导出包含资源 | ⭐⭐ | 打包导出 |
| 33 | `/api/export/batchExportMd` | 批量导出 Markdown | ⭐⭐ | 批量操作 |
| 34 | `/api/export/exportPDF` | 导出 PDF | ⭐⭐ | PDF 格式 |
| 35 | `/api/export/exportDocx` | 导出 Word 文档 | ⭐ | Office 格式 |

### 九、导入功能 (4个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 36 | `/api/import/importData` | 导入数据 | ⭐⭐ | 从其他软件导入 |
| 37 | `/api/import/importStdMd` | 导入标准 Markdown | ⭐⭐⭐ | 导入 MD 文件 |
| 38 | `/api/import/importNotebook` | 导入笔记本 | ⭐⭐ | 整个笔记本导入 |
| 39 | `/api/import/importSY` | 导入思源数据 | ⭐ | .sy 格式 |

### 十、笔记本高级操作 (4个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 40 | `/api/notebook/closeNotebook` | 关闭笔记本 | ⭐⭐ | 卸载笔记本 |
| 41 | `/api/notebook/createNotebook` | 创建笔记本 | ⭐⭐⭐ | 新建笔记本 |
| 42 | `/api/notebook/removeNotebook` | 删除笔记本 | ⭐⭐ | 删除整个笔记本 |
| 43 | `/api/notebook/renameNotebook` | 重命名笔记本 | ⭐⭐ | 修改笔记本名称 |

### 十一、文件树操作 (5个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 44 | `/api/filetree/listDocsByPath` | 按路径列出文档 | ⭐⭐ | 遍历目录 |
| 45 | `/api/filetree/moveDocs` | 移动文档 | ⭐⭐⭐ | 重新组织文档 |
| 46 | `/api/filetree/getHPathByPath` | 获取可读路径 | ⭐ | 路径转换 |
| 47 | `/api/filetree/getHPathByID` | 通过 ID 获取路径 | ⭐⭐ | ID 转路径 |
| 48 | `/api/filetree/searchDocs` | 搜索文档 | ⭐⭐ | 文档搜索 |

### 十二、引用和反向链接 (3个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 49 | `/api/ref/getBacklink` | 获取反向链接 | ⭐⭐⭐ | 知识图谱 |
| 50 | `/api/ref/getBacklink2` | 获取反向链接2 | ⭐⭐ | 增强版 |
| 51 | `/api/ref/getBackmention` | 获取反向提及 | ⭐⭐ | 提及关系 |

### 十三、标签和书签 (3个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 52 | `/api/tag/getTags` | 获取所有标签 | ⭐⭐ | 标签列表 |
| 53 | `/api/bookmark/getBookmark` | 获取书签 | ⭐ | 书签管理 |
| 54 | `/api/bookmark/renameBookmark` | 重命名书签 | ⭐ | 修改书签 |

### 十四、历史和版本 (4个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 55 | `/api/history/getDocHistoryContent` | 获取文档历史 | ⭐⭐ | 查看历史版本 |
| 56 | `/api/history/rollbackDocHistory` | 回滚文档历史 | ⭐⭐ | 恢复历史版本 |
| 57 | `/api/history/getNotebookHistory` | 获取笔记本历史 | ⭐ | 笔记本历史 |
| 58 | `/api/history/clearWorkspaceHistory` | 清理历史记录 | ⭐ | 清理存储空间 |

### 十五、快照功能 (3个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 59 | `/api/snapshot/createSnapshot` | 创建快照 | ⭐⭐ | 备份当前状态 |
| 60 | `/api/snapshot/rollbackSnapshot` | 回滚快照 | ⭐⭐ | 恢复快照 |
| 61 | `/api/snapshot/removeSnapshot` | 删除快照 | ⭐ | 清理快照 |

### 十六、同步和云端 (3个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 62 | `/api/sync/performSync` | 执行同步 | ⭐ | 云端同步 |
| 63 | `/api/sync/getSyncStatus` | 获取同步状态 | ⭐ | 同步进度 |
| 64 | `/api/sync/createCloudSnapshot` | 创建云端快照 | ⭐ | 云端备份 |

### 十七、其他专用功能 (8个)
| # | API 路径 | 功能 | 优先级 | 说明 |
|---|---------|------|--------|------|
| 65 | `/api/inbox/getShorthand` | 获取速记 | ⭐ | 速记功能 |
| 66 | `/api/notification/pushMsg` | 推送消息 | ⭐ | 通知提醒 |
| 67 | `/api/notification/pushErrMsg` | 推送错误消息 | ⭐ | 错误通知 |
| 68 | `/api/riff/getRiffDueCards` | 获取待复习卡片 | ⭐ | 间隔重复 |
| 69 | `/api/outline/getDocOutline` | 获取文档大纲 | ⭐⭐ | 文档结构 |
| 70 | `/api/block/getChildBlocks` | 获取子块 | ⭐⭐ | 块层级结构 |
| 71 | `/api/block/getBlockBreadcrumb` | 获取块面包屑 | ⭐ | 导航路径 |
| 72 | `/api/block/transferBlockRef` | 转换块引用 | ⭐ | 引用转换 |

---

## 优先级说明

- **⭐⭐⭐ 高优先级** - 常用功能，建议实现
- **⭐⭐ 中优先级** - 有用但不紧急
- **⭐ 低优先级** - 专用功能，按需实现

---

## 统计汇总

| 分类 | 已实现 | 未实现 | 总计 |
|------|-------|-------|------|
| 文档管理 | 5 | 0 | 5 |
| 块操作 | 7 | 3 | 10 |
| 搜索查询 | 3 | 0 | 3 |
| 笔记本管理 | 2 | 4 | 6 |
| 系统功能 | 3 | 0 | 3 |
| 资源文件 | 0 | 5 | 5 |
| 模板功能 | 0 | 4 | 4 |
| 导出功能 | 0 | 6 | 6 |
| 导入功能 | 0 | 4 | 4 |
| 文件树操作 | 0 | 5 | 5 |
| 引用反链 | 0 | 3 | 3 |
| 标签书签 | 0 | 3 | 3 |
| 历史版本 | 0 | 4 | 4 |
| 快照功能 | 0 | 3 | 3 |
| 同步云端 | 0 | 3 | 3 |
| 其他功能 | 0 | 8 | 8 |
| **总计** | **20** | **55** | **75** |

注：实际思源笔记 API 约 **75 个**（比之前估计的 62 个更多）

---

## 建议实现的高优先级 API（⭐⭐⭐）

如果要扩展功能，建议优先实现这 10 个：

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

**开发时间估计：** 2-3 天

---

## 您的决定？

现在您已经看到完整的 API 列表，您想：

1. **维持现状** - 20 个 API 已经足够
2. **扩展高优先级功能** - 实现上述 10 个 API
3. **完整实现** - 实现全部 75 个 API
4. **自定义选择** - 您指定要实现哪些 API

**请告诉我您的选择。**
