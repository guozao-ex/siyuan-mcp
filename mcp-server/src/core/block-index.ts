/**
 * blocks 索引查询辅助。
 *
 * 存在的理由：思源的 blocks 索引是**异步**构建的 —— 实测新建文档/块之后，
 * 约 1.0~1.2 秒（偶尔更久）它才会出现在 blocks 表里。
 *
 * 这意味着"写完立刻读"这个再自然不过的操作会失败：
 *   - read_block / read_document 报 "Block not found" / "Document not found"
 *   - insert_block_after / insert_block_before 因为查不到锚点块而报同样的错
 * 而块其实存在。AI Agent 的典型动作恰恰就是"写完立刻回读确认"。
 *
 * 因此凡是"按 ID 查块"的地方都统一走这里，带一小段等待窗口。
 */
import type { SiYuanClient } from '../siyuan/api.js';

/** 默认等待窗口：足够覆盖实测的索引延迟，同时不至于让"真的不存在"等太久 */
export const DEFAULT_INDEX_WAIT_MS = 3000;

/** 轮询间隔 */
const POLL_INTERVAL_MS = 200;

/**
 * 按 ID 查块，查不到时短暂重试。
 *
 * @returns 命中的行；超时仍未命中则返回 null（由调用方决定怎么报错）
 */
export async function findBlockRow(
  client: SiYuanClient,
  id: string,
  timeoutMs: number = DEFAULT_INDEX_WAIT_MS
): Promise<Record<string, any> | null> {
  // 思源块 ID 形如 20240101120000-abcdefg；仍做一次转义，避免拼进 SQL 时出错
  const safeId = String(id).replace(/'/g, "''");
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const rows = await client.sql(`SELECT * FROM blocks WHERE id = '${safeId}' LIMIT 1`);
      if (rows && rows.length > 0) return rows[0];
    } catch {
      // 索引尚未就绪时查询可能直接失败，继续重试
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** 索引未就绪时统一的错误提示后缀 */
export const INDEX_HINT =
  '（若该块是刚创建的，可能是思源的 blocks 索引尚未就绪，稍等约 1 秒后重试即可）';
