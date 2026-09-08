# 使用示例

本文档提供思源 MCP 的实际使用示例。

## 示例 1：搜索笔记

### 使用 MCP 工具

```bash
curl -X POST http://127.0.0.1:3000/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search_notes",
    "arguments": {
      "query": "JavaScript",
      "pageSize": 5
    }
  }'
```

### 响应示例

```json
{
  "content": [{
    "type": "text",
    "text": "{
      \"blocks\": [
        {
          \"id\": \"20240101120000-abcdefg\",
          \"type\": \"paragraph\",
          \"content\": \"JavaScript 是一种编程语言...\",
          \"path\": \"/技术笔记/JavaScript基础.sy\",
          \"notebook\": \"20240101-notebook\",
          \"created\": \"20240101120000\",
          \"updated\": \"20240101130000\"
        }
      ],
      \"total\": 15,
      \"page\": 1,
      \"pageSize\": 5
    }"
  }]
}
```

### 在 Claude Desktop 中使用

配置 Claude Desktop 后，直接对话：

```
你：帮我搜索关于 JavaScript 的笔记

Claude：我找到了 15 条关于 JavaScript 的笔记。以下是最相关的几条：
1. JavaScript基础 - 介绍了 JavaScript 的基本语法...
2. ES6 新特性 - 涵盖了箭头函数、Promise 等...
...
```

## 示例 2：读取笔记

### 读取单个块

```bash
curl -X POST http://127.0.0.1:3000/read \
  -H "Content-Type: application/json" \
  -d '{
    "id": "20240101120000-abcdefg"
  }'
```

### 读取完整文档

```bash
curl -X POST http://127.0.0.1:3000/document \
  -H "Content-Type: application/json" \
  -d '{
    "id": "20240101120000-abcdefg",
    "includeChildren": true
  }'
```

### 响应示例

```json
{
  "content": [{
    "type": "text",
    "text": "{
      \"id\": \"20240101120000-abcdefg\",
      \"name\": \"JavaScript基础\",
      \"content\": \"# JavaScript基础\\n\\n...\",
      \"markdown\": \"# JavaScript基础\\n\\n这是内容...\",
      \"refCount\": 3,
      \"subFileCount\": 0,
      \"created\": \"20240101120000\",
      \"updated\": \"20240101130000\"
    }"
  }]
}
```

## 示例 3：创建笔记

### 创建新文档

```bash
curl -X POST http://127.0.0.1:3000/create \
  -H "Content-Type: application/json" \
  -d '{
    "notebook": "20240101-notebook",
    "path": "/新笔记.sy",
    "title": "我的新笔记",
    "content": "这是笔记内容\\n\\n## 第一节\\n\\n这是第一节的内容。"
  }'
```

### 响应示例

```json
{
  "content": [{
    "type": "text",
    "text": "{
      \"id\": \"20240101140000-newdoc\",
      \"path\": \"/新笔记.sy\",
      \"message\": \"Document created successfully: 我的新笔记\"
    }"
  }]
}
```

## 示例 4：更新笔记

### 更新块内容

```bash
curl -X POST http://127.0.0.1:3000/update \
  -H "Content-Type: application/json" \
  -d '{
    "id": "20240101120000-abcdefg",
    "content": "更新后的内容"
  }'
```

### 追加内容

```bash
curl -X POST http://127.0.0.1:3000/append \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "20240101120000-abcdefg",
    "content": "## 新增章节\\n\\n这是追加的内容。"
  }'
```

## 示例 5：在插件中使用

### 总结块内容

1. 选择一个包含较长文本的块
2. 右键点击
3. 选择 **AI 总结**
4. 等待处理完成

插件会：
- 读取块内容
- 调用 MCP 服务器
- 生成摘要
- 追加到块后面

### AI 对话

1. 点击顶栏 🤖 图标
2. 输入：`帮我找一下关于 Python 的笔记`
3. 查看响应

插件会：
- 调用搜索工具
- 查找相关笔记
- 返回搜索结果作为上下文

## 示例 6：使用 SQL 查询

### 直接 SQL 查询（高级）

虽然不通过标准 MCP 工具暴露，但你可以通过 API 客户端使用：

```typescript
import { createClient } from './siyuan/api';

const client = createClient();

// 查询最近更新的 10 条笔记
const result = await client.sql(`
  SELECT *
  FROM blocks
  WHERE type = 'd'
  ORDER BY updated DESC
  LIMIT 10
`);

console.log(result.rows);
```

## 示例 7：批量操作

### 批量搜索和读取

```typescript
// 搜索多个关键词
const keywords = ['JavaScript', 'Python', 'TypeScript'];

for (const keyword of keywords) {
  const result = await fetch('http://127.0.0.1:3000/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: keyword, pageSize: 5 }),
  });
  
  const data = await result.json();
  console.log(`${keyword}: ${data.total} 条结果`);
}
```

## 示例 8：错误处理

### 处理 API 错误

```typescript
try {
  const response = await fetch('http://127.0.0.1:3000/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'read_block',
      arguments: { id: 'invalid-id' },
    }),
  });

  const data = await response.json();

  if (data.isError) {
    const error = JSON.parse(data.content[0].text);
    console.error('操作失败:', error.error);
  } else {
    const result = JSON.parse(data.content[0].text);
    console.log('成功:', result);
  }
} catch (error) {
  console.error('请求失败:', error);
}
```

## 示例 9：性能优化

### 利用缓存

MCP 服务器自动缓存以下请求：
- `listNotebooks` - 缓存 1 分钟
- `getBlockKramdown` - 缓存 5 分钟

```bash
# 第一次调用 - 从 API 获取
curl -X POST http://127.0.0.1:3000/notebooks

# 第二次调用 - 从缓存返回（更快）
curl -X POST http://127.0.0.1:3000/notebooks
```

### 注意事项

- 更新操作会自动失效相关缓存
- 可以通过重启服务器清空缓存

## 更多示例

查看以下文档了解更多：
- [高级用法](./ADVANCED.md)
- [API 文档](./API.md)
- [开发指南](../DEVELOPMENT.md)
