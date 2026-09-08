# API 文档

思源 MCP 服务器 API 参考文档。

## 基础信息

- **Base URL**: `http://127.0.0.1:3000` (默认)
- **Content-Type**: `application/json`
- **Rate Limit**: 60 请求/分钟/IP

## 通用端点

### 健康检查

检查服务器状态。

```http
GET /health
```

**响应**:

```json
{
  "status": "ok",
  "timestamp": 1234567890123
}
```

### 列出工具

获取所有可用的 MCP 工具。

```http
GET /tools
```

**响应**:

```json
{
  "tools": [
    "search_notes",
    "list_notebooks",
    "read_block",
    "read_document",
    "create_document",
    "update_block",
    "append_block",
    "delete_block"
  ]
}
```

## MCP 工具端点

### 统一调用端点

调用任意 MCP 工具。

```http
POST /tools/call
```

**请求体**:

```json
{
  "name": "tool_name",
  "arguments": {
    "arg1": "value1",
    "arg2": "value2"
  }
}
```

**响应**:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"result\": \"...\"}"
    }
  ],
  "isError": false
}
```

## 搜索工具

### 搜索笔记

```http
POST /search
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | ✅ | 搜索关键词 |
| notebooks | string[] | ❌ | 笔记本 ID 列表 |
| page | number | ❌ | 页码（默认 1） |
| pageSize | number | ❌ | 每页数量（默认 20，最大 100） |

**示例**:

```json
{
  "query": "JavaScript",
  "pageSize": 10
}
```

**响应**:

```json
{
  "blocks": [
    {
      "id": "20240101120000-abcdefg",
      "type": "paragraph",
      "content": "JavaScript 是...",
      "path": "/技术/JavaScript.sy",
      "notebook": "20240101-notebook",
      "created": "20240101120000",
      "updated": "20240101130000"
    }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 10
}
```

### 列出笔记本

```http
POST /notebooks
```

**参数**: 无

**响应**:

```json
[
  {
    "id": "20240101-notebook",
    "name": "我的笔记本",
    "icon": "📔",
    "closed": false
  }
]
```

## 读取工具

### 读取块

```http
POST /read
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 块 ID |
| includeAttributes | boolean | ❌ | 是否包含属性 |

**示例**:

```json
{
  "id": "20240101120000-abcdefg",
  "includeAttributes": true
}
```

**响应**:

```json
{
  "id": "20240101120000-abcdefg",
  "content": "块内容",
  "markdown": "# 标题\n\n内容...",
  "attributes": {
    "custom-attr": "value"
  }
}
```

### 读取文档

```http
POST /document
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 文档 ID |
| includeChildren | boolean | ❌ | 是否包含子块（默认 true） |

**响应**:

```json
{
  "id": "20240101120000-abcdefg",
  "name": "文档标题",
  "content": "文档内容",
  "markdown": "# 标题\n\n完整内容...",
  "refCount": 3,
  "subFileCount": 0,
  "created": "20240101120000",
  "updated": "20240101130000"
}
```

## 写入工具

### 创建文档

```http
POST /create
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| notebook | string | ✅ | 笔记本 ID |
| path | string | ✅ | 文档路径 |
| title | string | ✅ | 文档标题 |
| content | string | ❌ | 文档内容（Markdown） |

**示例**:

```json
{
  "notebook": "20240101-notebook",
  "path": "/新笔记.sy",
  "title": "我的笔记",
  "content": "这是内容"
}
```

**响应**:

```json
{
  "id": "20240101140000-newdoc",
  "path": "/新笔记.sy",
  "message": "Document created successfully: 我的笔记"
}
```

### 更新块

```http
POST /update
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 块 ID |
| content | string | ✅ | 新内容（Markdown） |

**响应**:

```json
{
  "id": "20240101120000-abcdefg",
  "message": "Block updated successfully"
}
```

### 追加块

```http
POST /append
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| parentId | string | ✅ | 父块 ID |
| content | string | ✅ | 追加内容（Markdown） |

**响应**:

```json
{
  "id": "20240101150000-newblock",
  "parentId": "20240101120000-abcdefg",
  "message": "Content appended successfully"
}
```

### 删除块

```http
POST /delete
```

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 块 ID |

**响应**:

```json
{
  "id": "20240101120000-abcdefg",
  "message": "Block deleted successfully"
}
```

## 错误响应

### 错误格式

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\": \"错误信息\"}"
    }
  ],
  "isError": true
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 429 | 速率限制 |
| 500 | 服务器内部错误 |

### 常见错误

```json
// 工具名称缺失
{
  "error": "Tool name is required"
}

// 未知工具
{
  "error": "Unknown tool: invalid_tool"
}

// 块不存在
{
  "error": "Block not found: invalid-id"
}

// 速率限制
{
  "error": "Too many requests",
  "resetAt": "2024-01-01T12:05:00.000Z"
}
```

## 速率限制

- **限制**: 60 请求/分钟/IP
- **响应头**: 包含 rate limit 信息（未实现）
- **超限**: 返回 429 状态码和 resetAt 时间

## 认证

当前版本不需要认证。未来版本可能添加 API Key 认证。

## CORS

- **允许源**: `*` (所有源)
- **允许方法**: GET, POST, OPTIONS
- **允许头**: Content-Type, Authorization

## 示例代码

### JavaScript/TypeScript

```typescript
async function searchNotes(query: string) {
  const response = await fetch('http://127.0.0.1:3000/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, pageSize: 10 }),
  });

  const data = await response.json();
  const result = JSON.parse(data.content[0].text);
  return result;
}
```

### Python

```python
import requests

def search_notes(query: str):
    response = requests.post(
        'http://127.0.0.1:3000/search',
        json={'query': query, 'pageSize': 10}
    )
    data = response.json()
    result = json.loads(data['content'][0]['text'])
    return result
```

### curl

```bash
curl -X POST http://127.0.0.1:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "pageSize": 10}'
```

## 更多信息

- [使用示例](./EXAMPLES.md)
- [配置指南](../mcp-server/CONFIG.md)
- [开发文档](../DEVELOPMENT.md)
