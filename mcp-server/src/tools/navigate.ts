/**
 * 导航与关系类工具 —— **全部只读**。
 *
 * 它们的作用是让 AI Agent 建立"笔记库地图"：
 *   - 一条笔记被谁引用（反向链接 / 提及）
 *   - 某个块位于文档的什么位置（面包屑）
 *   - 文档的章节结构（大纲）
 *   - 库里有哪些标签、某个标签下有哪些块
 *   - 某个目录下有哪些文档
 *
 * 没有这些能力时，Agent 只能靠关键词盲搜 —— 而**双链恰恰是思源笔记最核心的价值**，
 * 之前 Agent 完全看不到笔记之间的关联。
 *
 * 本模块所有函数都只调用思源的只读接口，不产生任何写入。
 */
import type { SiYuanClient } from '../siyuan/api.js';

/**
 * 引用关系：指向某个笔记/块的引用与提及。
 *
 * 实现说明：**不使用** `/api/ref/getAllReferences` —— 实测它在无结果时返回**空 body**
 * （思源的行为），不可靠。这里改用 `/api/ref/getBacklink`：它稳定返回
 * `{ backlinks[], linkRefsCount, mentionsCount }`，其中提及只有计数、没有内容，
 * 因此把 mentionsCount 如实作为"提及数"给出，而不是伪造一个空数组。
 */
export async function getBacklinks(
  client: SiYuanClient,
  args: { id: string }
): Promise<Record<string, unknown>> {
  const res = await client.getBacklink({ id: args.id });

  // data 可能为 null（例如目标还没有任何引用）
  const backlinks = res?.backlinks ?? [];

  return {
    id: args.id,
    backlinkCount: backlinks.length,
    linkRefsCount: res?.linkRefsCount ?? backlinks.length,
    // 提及（正文里提到该块标题但未建立引用）只有数量，没有内容 —— 思源不在这个接口里返回
    mentionsCount: res?.mentionsCount ?? 0,
    backlinks: backlinks.map((item) => ({
      id: item.id,
      // blockPaths 是引用所在文档的层级路径，比裸 ID 有用得多
      path: (item.blockPaths ?? []).map((p) => p.name).filter(Boolean).join(' / '),
      blockId: item.block?.id,
      content: item.block?.content,
    })),
  };
}

/**
 * 块的面包屑：它在文档中的层级位置。
 * 用来回答"这个块在哪一节的什么位置"，是理解块上下文最省 token 的方式。
 */
export async function getBlockBreadcrumb(
  client: SiYuanClient,
  args: { id: string }
): Promise<Record<string, unknown>> {
  const res = await client.getBlockBreadcrumb(args.id);
  const breadcrumb = res.breadcrumb ?? [];

  return {
    id: args.id,
    breadcrumb: breadcrumb.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
    })),
    // 便于直接展示/阅读的路径串
    pathText: breadcrumb
      .map((item) => item.name)
      .filter(Boolean)
      .join(' / '),
  };
}

/**
 * 文档大纲：只用一次调用就能掌握整篇结构，
 * 让 Agent 不必把全文读进来就能决定该深入哪一节。
 */
export async function getDocOutline(
  client: SiYuanClient,
  args: { id: string }
): Promise<Record<string, unknown>> {
  const res = await client.getDocOutline(args.id);
  const outline = res.blocks ?? [];

  return {
    id: args.id,
    headingCount: outline.length,
    outline: outline.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      depth: item.depth,
      blockCount: item.count,
    })),
  };
}

/**
 * 列出所有标签（可按关键词过滤）。
 *
 * ⚠️ 没有用 `/api/tag/getTags` —— 实测该接口返回**空响应**（不可用）。
 * 改为从 blocks 表的 tag 字段聚合：思源把一条块上的标签存成 `#a# #b#` 这样的字符串。
 */
export async function getTags(
  client: SiYuanClient,
  args: { query?: string } = {}
): Promise<Record<string, unknown>> {
  const rows = await client.sql("SELECT tag FROM blocks WHERE tag IS NOT NULL AND tag != ''");

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const raw = String((row as Record<string, unknown>).tag ?? '');
    // tag 形如 "#标签# #另一个#"；按 # 切分后过滤空段
    for (const piece of raw.split('#')) {
      const name = piece.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  let tags = Array.from(counts, ([name, count]) => ({ name, count }));
  if (args.query && args.query.trim()) {
    const needle = args.query.trim().toLowerCase();
    tags = tags.filter((item) => item.name.toLowerCase().includes(needle));
  }
  tags.sort((a, b) => b.count - a.count);

  return {
    total: tags.length,
    tags,
  };
}

/**
 * 某个标签下的块。
 *
 * ⚠️ 没有用 `/api/tag/getTag` —— 实测它返回的是**标签树**（所有标签及层级），
 * 并不是"该标签下的块"。这里同样改为查 blocks.tag。
 */
export async function getBlocksByTag(
  client: SiYuanClient,
  args: { tag: string }
): Promise<Record<string, unknown>> {
  // 允许调用方带或不带 # 号
  const tag = String(args.tag).replace(/^#+/, '').replace(/#+$/, '').trim();
  const safeTag = tag.replace(/'/g, "''");

  const rows = await client.sql(
    `SELECT id, type, content, hpath FROM blocks WHERE tag LIKE '%#${safeTag}#%' LIMIT 200`
  );
  const blocks = rows ?? [];

  return {
    tag,
    count: blocks.length,
    returned: blocks.length,
    blocks: blocks.map((block) => {
      const row = block as Record<string, unknown>;
      return {
        id: row.id,
        type: row.type,
        content: row.content,
        path: row.hpath,
      };
    }),
  };
}

/**
 * 列出某个笔记本目录下的文档。
 * 配合 read_document 使用，可以先把目录摸清楚再决定读哪些。
 */
export async function listDocsByPath(
  client: SiYuanClient,
  args: { notebook: string; path?: string }
): Promise<Record<string, unknown>> {
  const path = args.path && args.path.trim() ? args.path.trim() : '/';
  const res = await client.listDocsByPath(args.notebook, path);
  const files = res.files ?? [];

  return {
    notebook: args.notebook,
    path,
    documentCount: files.length,
    documents: files.map((file) => ({
      id: file.id,
      name: file.name || file.name1,
      path: file.path,
      subFileCount: file.subFileCount,
    })),
  };
}


// ==================== 路径 / 结构 / 搜索 / 导出（只读）====================

/**
 * 解析人可读路径（hpath）。
 * 支持两种用法：按块/文档 ID，或按 notebook + path。前者更常用。
 */
export async function getPath(
  client: SiYuanClient,
  args: { id?: string; notebook?: string; path?: string }
): Promise<Record<string, unknown>> {
  if (args.id) {
    const hpath = await client.getHPathByID(args.id);
    return { id: args.id, hpath: hpath || '' };
  }
  if (args.notebook && args.path) {
    const hpath = await client.getHPathByPath(args.notebook, args.path);
    return { notebook: args.notebook, path: args.path, hpath: hpath || '' };
  }
  throw new Error('需要提供 id，或同时提供 notebook 与 path');
}

/** 文件树：某个笔记本目录下的完整结构（含子目录） */
export async function getFileTree(
  client: SiYuanClient,
  args: { notebook: string; path?: string }
): Promise<Record<string, unknown>> {
  const res = await client.getFileTree(args.notebook, args.path);
  const files = res?.files ?? [];
  return {
    notebook: args.notebook,
    path: args.path || '/',
    entryCount: files.length,
    files,
  };
}

/** 子块：某个块的直接下级块 */
export async function getChildBlocks(
  client: SiYuanClient,
  args: { id: string }
): Promise<Record<string, unknown>> {
  const blocks = await client.getChildBlocksApi(args.id);
  return {
    id: args.id,
    count: blocks?.length ?? 0,
    blocks: (blocks ?? []).map((block) => ({
      id: block.id,
      type: block.type,
      content: block.content,
    })),
  };
}

/** 按关键词搜索文档（返回文档级结果，而不是块级） */
export async function searchDocs(
  client: SiYuanClient,
  args: { keyword: string; notebook?: string }
): Promise<Record<string, unknown>> {
  const res = await client.searchDocs({ k: args.keyword, notebook: args.notebook });
  const docs = res?.docs ?? [];
  return {
    keyword: args.keyword,
    count: docs.length,
    docs,
  };
}

/**
 * 全文搜索块。
 *
 * 实测该接口**可用**（此前项目文档判断它"返回空"是误判）。
 * 与 search_notes 的区别：search_notes 走 SQL 的 LIKE 匹配，这里是思源自己的
 * 全文索引，对中文分词与相关性排序更友好，适合"找出最相关的几条"。
 */
export async function searchFulltext(
  client: SiYuanClient,
  args: { query: string; types?: string[] }
): Promise<Record<string, unknown>> {
  const res = await client.fullTextSearchBlock(args.query, args.types);
  const blocks = res?.blocks ?? [];
  return {
    query: args.query,
    count: blocks.length,
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      content: block.content,
      path: block.hpath || block.path,
    })),
  };
}

/** 导出文档的 Markdown 内容（只读，不写文件） */
export async function exportMarkdown(
  client: SiYuanClient,
  args: { id: string }
): Promise<Record<string, unknown>> {
  const res = await client.exportMdContent(args.id);
  return {
    id: args.id,
    hPath: res?.hPath,
    content: res?.content ?? '',
  };
}

/**
 * 渲染思源模板。
 * 支持三种输入：模板内容(ID+path)、直接渲染文本、或 Sprig 片段。
 */
export async function renderTemplate(
  client: SiYuanClient,
  args: { id?: string; path?: string; template?: string; sprig?: string }
): Promise<Record<string, unknown>> {
  if (args.sprig) {
    const rendered = await client.renderSprig(args.sprig);
    return { mode: 'sprig', input: args.sprig, rendered };
  }
  if (args.template) {
    const rendered = await client.renderTemplateContent(args.id || '', args.template);
    return { mode: 'content', input: args.template, rendered };
  }
  if (args.id && args.path) {
    const res = await client.renderTemplate({ id: args.id, path: args.path });
    return { mode: 'template', id: args.id, path: args.path, rendered: res?.content ?? '' };
  }
  throw new Error('需要提供 sprig、template，或 id + path 之一');
}