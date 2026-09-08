# API 修复清单

## 已确认的问题

### 1. ❌ getBlockAttrs - 路径错误
**问题：** 使用了 `/api/block/getBlockAttrs`  
**修复：** 改为 `/api/attr/getBlockAttrs` ✅  
**状态：** 已修复

### 2. ❌ getTags - API 不存在
**问题：** 思源 v3.8.2 没有独立的 getTags API  
**替代方案：** 使用 SQL 查询 `SELECT DISTINCT tag FROM blocks WHERE tag != ""`  
**状态：** 需要重新实现

### 3. ❌ searchBlock - 返回空
**问题：** API 端点可能不稳定  
**替代方案：** 已有 SQL 实现的 searchBlocks  
**状态：** 已有替代

### 4. ❌ getFileTree - API 不存在
**问题：** 没有 `/api/filetree/getFileTree`  
**替代方案：** 使用 `listDocsByPath`  
**状态：** 已有替代

### 5. ❌ listTemplates - API 不存在
**问题：** 没有独立的模板列表 API  
**替代方案：** 通过文件系统或 SQL 查询  
**状态：** 需要重新实现

### 6. ❌ getShorthand - 参数错误
**问题：** 需要 id 参数  
**修复：** 文档错误，此 API 需要 id  
**状态：** 需要更正文档

### 7. ❌ getSyncStatus - 可能需要云端配置
**问题：** 本地版本可能不支持  
**状态：** 环境相关

### 8. ❌ createSnapshot - 可能需要配置
**问题：** 可能需要先配置快照目录  
**状态：** 环境相关

---

## 修复策略

### 立即修复 (必须)
1. ✅ getBlockAttrs - 路径修正

### 替代实现 (推荐)
2. getTags - 用 SQL 实现
3. listTemplates - 用文件系统 API

### 文档更新 (必要)
4. 标注哪些 API 在特定版本可用
5. 说明环境依赖 (云端同步、快照配置)

### 可选 (低优先级)
6. 为不可用的 API 提供优雅降级

---

## 下一步行动

1. ✅ 修复 getBlockAttrs 路径
2. ⏸️ 重新实现 getTags (用 SQL)
3. ⏸️ 更新 API 文档说明
4. ⏸️ 重新运行完整测试
