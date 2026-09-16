/**
 * 系统状态与元信息类工具 —— **全部只读**。
 *
 * 这些接口回答的是"思源现在是什么状态"：版本、启动进度、同步状态、历史记录、
 * 模板、书签、间隔重复卡片。它们不修改任何笔记内容。
 *
 * 注意思源个别接口在"无数据"时会返回**空 body**（例如 /api/sync/getSyncStatus），
 * 这不是错误 —— SiYuanClient.request() 会把空响应当作 null 返回，这里统一按
 * "暂无数据"呈现，而不是抛错。
 */
import type { SiYuanClient } from '../siyuan/api.js';

/**
 * 系统信息：版本 / 连通性 / 启动进度。
 * 合并成一次调用，省掉 Agent 为了确认"服务器活着吗"而发多次请求。
 */
export async function getSystemInfo(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const [version, bootProgress] = await Promise.all([
    client.getVersion().catch(() => null),
    client.getBootProgress().catch(() => null),
  ]);

  let status: Record<string, unknown> | null = null;
  try {
    const raw = await client.getConnectionStatus();
    status = raw as unknown as Record<string, unknown>;
  } catch (error) {
    status = { error: String((error as Error)?.message || error) };
  }

  return {
    version: version || null,
    bootProgress: bootProgress
      ? { progress: bootProgress.progress, details: bootProgress.details }
      : null,
    connection: status,
  };
}

/**
 * 同步状态。
 * 未开启同步（或该版本不返回内容）时 data 为空 —— 那不是错误。
 */
export async function getSyncStatus(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await client.getSyncStatus();
  if (!res) {
    return {
      available: false,
      note: '思源未返回同步状态（可能未登录云端 / 未开启同步）',
    };
  }
  return { available: true, ...(res as unknown as Record<string, unknown>) };
}

/**
 * 历史记录。
 * - 传 path：返回该**文档**的历史版本
 * - 只传 notebook：返回该**笔记本**的历史
 *
 * 注意：这里只**列出**历史，不做回滚 —— 回滚会覆盖当前内容，属于需要用户确认的操作。
 */
export async function getHistory(
  client: SiYuanClient,
  args: { notebook: string; path?: string }
): Promise<Record<string, unknown>> {
  if (args.path) {
    const res = await client.getDocHistory({ notebook: args.notebook, path: args.path });
    const histories = res?.histories ?? [];
    return {
      scope: 'document',
      notebook: args.notebook,
      path: args.path,
      count: histories.length,
      histories,
    };
  }

  const res = await client.getNotebookHistory(args.notebook);
  const histories = res?.histories ?? [];
  return {
    scope: 'notebook',
    notebook: args.notebook,
    count: histories.length,
    histories,
  };
}

/** 列出所有模板文件 */
export async function listTemplates(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await client.listTemplates();
  const templates = res?.templates ?? [];
  return { count: templates.length, templates };
}

/** 列出所有书签 */
export async function getBookmarks(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await client.getBookmark();
  const bookmarks = (res as unknown as { bookmarks?: unknown[] })?.bookmarks ?? [];
  return { count: bookmarks.length, bookmarks };
}

/**
 * 间隔重复（Riff）今日到期卡片。
 * 未启用间隔重复时返回空。
 */
export async function getDueCards(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await client.getRiffDueCards();
  const cards = (res as unknown as { cards?: unknown[] })?.cards ?? [];
  return { count: cards.length, cards };
}

/**
 * 查询"提及"（正文里提到某块标题、但未建立引用链接）。
 * 与 get_backlinks 互补：那个给引用关系，这个给纯文本提及。
 */
export async function getShorthand(
  client: SiYuanClient,
  args: { id?: string } = {}
): Promise<Record<string, unknown>> {
  const res = await client.getShorthand(args.id);
  const shorthand = res?.shorthand ?? [];
  return { id: args.id ?? null, count: shorthand.length, shorthand };
}
