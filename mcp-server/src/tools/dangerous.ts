/**
 * 高危操作工具集。
 *
 * ⚠️ 这个文件里的每个工具都会**删除、覆盖或改变**用户的数据状态。
 * 它们的共同约定：
 *   1. registry 里标 `destructiveHint: true`（唯一例外见各工具说明）
 *   2. description 首行写明 **ASK THE USER FIRST**
 *   3. 只做"工具能做的事"，不替用户做决定 —— 参数必须显式给出
 *
 * 为什么单独放一个文件：让"哪些能力是危险的"一眼可见，
 * 而不是埋在几十个只读工具中间。
 *
 * 这些工具是本项目作者**逐项明确授权**后才注册的（默认不暴露）。
 */
import type { SiYuanClient } from '../siyuan/api.js';

// ==================== 删除类 ====================

/**
 * 删除笔记本。
 *
 * ⚠️ 这是最危险的操作：会连同笔记本里的**所有文档**一起删除。
 */
export async function deleteNotebook(
  client: SiYuanClient,
  args: { notebook: string }
): Promise<Record<string, unknown>> {
  await client.removeNotebook(args.notebook);
  return {
    notebook: args.notebook,
    deleted: true,
    message: 'Notebook deleted (together with all documents inside it)',
  };
}

/**
 * 删除未使用的资源文件。
 * ⚠️ 会**真的从磁盘删掉文件**。调用前应先用 list_unused_assets 让用户确认清单。
 */
export async function deleteUnusedAssets(
  client: SiYuanClient,
  args: { paths: string[] }
): Promise<Record<string, unknown>> {
  const paths = args.paths ?? [];
  await client.removeUnusedAssets(paths);
  return {
    deletedCount: paths.length,
    paths,
    message: 'Unused assets permanently deleted from disk',
  };
}

/** 删除快照 */
export async function deleteSnapshot(
  client: SiYuanClient,
  args: { ids: string[] }
): Promise<Record<string, unknown>> {
  const ids = args.ids ?? [];
  await client.removeSnapshot(ids);
  return { deletedCount: ids.length, ids, message: 'Snapshot(s) deleted' };
}

// ==================== 回滚类 ====================

/** 回滚到某个快照 ⚠️ 会覆盖当前工作空间内容 */
export async function rollbackSnapshot(
  client: SiYuanClient,
  args: { id: string }
): Promise<Record<string, unknown>> {
  await client.rollbackSnapshot(args.id);
  return {
    id: args.id,
    message: 'Workspace rolled back to the snapshot — CURRENT CONTENT WAS OVERWRITTEN',
  };
}

/** 回滚文档到某个历史版本 ⚠️ 会覆盖该文档的当前内容 */
export async function rollbackDocHistory(
  client: SiYuanClient,
  args: { notebook: string; path: string; historyPath: string }
): Promise<Record<string, unknown>> {
  await client.rollbackDocHistory({
    notebook: args.notebook,
    path: args.path,
    historyPath: args.historyPath,
  });
  return {
    notebook: args.notebook,
    path: args.path,
    historyPath: args.historyPath,
    message: 'Document rolled back to that history version — CURRENT CONTENT WAS OVERWRITTEN',
  };
}

/** 清空工作空间历史记录 ⚠️ 之后将无法再回滚到任何历史版本 */
export async function clearWorkspaceHistory(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  await client.clearWorkspaceHistory();
  return {
    cleared: true,
    message: 'All workspace history cleared — past versions can no longer be restored',
  };
}

// ==================== 导入类 ====================

/**
 * 导入 Markdown 文件夹。
 * ⚠️ 目标路径下若存在同名文档，可能被覆盖。
 * 注意：`localPath` 是**服务端文件系统**上的路径，不是思源内的路径。
 */
export async function importMarkdown(
  client: SiYuanClient,
  args: { notebook: string; localPath: string; toPath: string }
): Promise<Record<string, unknown>> {
  const res = await client.importStdMd({
    notebook: args.notebook,
    localPath: args.localPath,
    toPath: args.toPath,
  });
  return {
    id: res?.id ?? null,
    notebook: args.notebook,
    localPath: args.localPath,
    toPath: args.toPath,
    message: 'Markdown imported (existing documents with the same name may have been overwritten)',
  };
}

/** 导入 .sy 压缩包 */
export async function importSiyuanArchive(
  client: SiYuanClient,
  args: { localPath: string }
): Promise<Record<string, unknown>> {
  await client.importSY(args.localPath);
  return { localPath: args.localPath, message: 'SiYuan archive (.sy) imported' };
}

/** 导入通用数据 */
export async function importData(
  client: SiYuanClient,
  args: { notebook: string; localPath: string; toPath: string }
): Promise<Record<string, unknown>> {
  await client.importData({
    notebook: args.notebook,
    localPath: args.localPath,
    toPath: args.toPath,
  });
  return {
    notebook: args.notebook,
    localPath: args.localPath,
    toPath: args.toPath,
    message: 'Data imported (existing documents with the same name may have been overwritten)',
  };
}

/** 导入笔记本 */
export async function importNotebook(
  client: SiYuanClient,
  args: { localPath: string }
): Promise<Record<string, unknown>> {
  await client.importNotebook({ localPath: args.localPath });
  return { localPath: args.localPath, message: 'Notebook imported' };
}

// ==================== 导出类 ====================

/**
 * 导出 PDF。
 * 非破坏性（不修改笔记内容），但会往工作空间写文件，且耗时较长。
 */
export async function exportPdf(
  client: SiYuanClient,
  args: { id: string; savePath?: string }
): Promise<Record<string, unknown>> {
  await client.exportPDF({ id: args.id, savePath: args.savePath });
  return {
    id: args.id,
    savePath: args.savePath ?? null,
    message: 'PDF exported (a file was written into the workspace)',
  };
}

/** 导出 DOCX */
export async function exportDocx(
  client: SiYuanClient,
  args: { id: string; savePath?: string }
): Promise<Record<string, unknown>> {
  await client.exportDocx({ id: args.id, savePath: args.savePath });
  return {
    id: args.id,
    savePath: args.savePath ?? null,
    message: 'DOCX exported (a file was written into the workspace)',
  };
}

/** 导出 HTML */
export async function exportHtml(
  client: SiYuanClient,
  args: { id: string; pdf?: boolean; savePath?: string }
): Promise<Record<string, unknown>> {
  const res = await client.exportHTML({
    id: args.id,
    pdf: args.pdf,
    savePath: args.savePath,
  });
  return {
    id: args.id,
    zip: res?.zip ?? null,
    html: res?.html ?? null,
    message: 'HTML exported (a file was written into the workspace)',
  };
}

/** 把整个笔记本目录导出为 Markdown（⚠️ 文件多时很重） */
export async function exportMarkdownBatch(
  client: SiYuanClient,
  args: { notebook: string; path: string }
): Promise<Record<string, unknown>> {
  await client.batchExportMd({ notebook: args.notebook, path: args.path });
  return {
    notebook: args.notebook,
    path: args.path,
    message: 'Batch Markdown export finished (files written into the workspace)',
  };
}

/** 导出资源（打包为 .zip） */
export async function exportResources(
  client: SiYuanClient,
  args: { path: string }
): Promise<Record<string, unknown>> {
  const res = await client.exportResources(args.path);
  return {
    path: res?.path ?? args.path,
    zip: res?.zip ?? null,
    message: 'Resources exported',
  };
}

// ==================== 系统类 ====================

/**
 * 触发同步。
 * ⚠️ 系统级动作：会与云端交换数据，可能改变本地或云端的状态。
 */
export async function triggerSync(
  client: SiYuanClient,
  args: { mobileSwitch?: boolean } = {}
): Promise<Record<string, unknown>> {
  await client.performSync(args.mobileSwitch);
  return { triggered: true, message: 'Sync triggered' };
}

/** 敏感字段名（命中则脱敏），避免把 Token / 密钥回传给模型 */
const SENSITIVE_KEY = /(token|apikey|api_key|secret|password|passwd|credential|accesskey)/i;

/** 递归脱敏对象中的敏感字段 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key) && typeof item === 'string' && item.length > 0) {
      out[key] = '***redacted***';
    } else {
      out[key] = redact(item, depth + 1);
    }
  }
  return out;
}

/**
 * 读取思源配置。
 *
 * 只读操作，但配置里可能包含 **API Token 等敏感信息** ——
 * 因此这里会先做脱敏（字段名含 token / apikey / secret / password 的值一律替换为
 * `***redacted***`），避免把密钥回传给模型。
 */
export async function getConfig(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await client.getConf();
  return {
    conf: redact(res?.conf ?? {}),
    note: 'Sensitive fields (token/apikey/secret/password) are redacted automatically.',
  };
}

// ==================== 通知类 ====================

/**
 * 在思源界面弹出消息提示。
 * 最"无害"的一个：只影响界面，不碰任何数据。
 */
export async function pushMessage(
  client: SiYuanClient,
  args: { message: string; timeout?: number; error?: boolean }
): Promise<Record<string, unknown>> {
  if (args.error) {
    await client.pushErrMsg(args.message, args.timeout);
  } else {
    await client.pushMsg(args.message, args.timeout);
  }
  return { shown: true, message: args.message, error: Boolean(args.error) };
}
