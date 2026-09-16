/**
 * 库级操作工具：笔记本、资源、模板、快照、书签、移动与引用转移。
 *
 * 风险约定（与 registry 的 annotations 一致）：
 *   - 本模块里的"创建 / 重命名 / 打开 / 关闭 / 移动 / 上传 / 存模板 / 建快照 / 改书签名"
 *     都**不会销毁既有内容**，因此标 destructiveHint: false。
 *   - 真正会删除或覆盖的操作（删除笔记本、删除未使用资源、删除/回滚快照、
 *     回滚文档历史、清空工作空间历史、导入覆盖）**不在此模块** ——
 *     它们属于高危操作，需要用户明确授权后才提供。
 */
import type { SiYuanClient } from '../siyuan/api.js';

// ==================== 笔记本 ====================

/** 新建笔记本 */
export async function createNotebook(
  client: SiYuanClient,
  args: { name: string; icon?: string }
): Promise<Record<string, unknown>> {
  const res = await client.createNotebook({ name: args.name, icon: args.icon });

  // 思源把结果包在 data.notebook 里（见 CreateNotebookResponse 的注释）
  const notebook = res?.notebook;
  return {
    id: notebook?.id ?? null,
    name: notebook?.name ?? args.name,
    message: `Notebook created: ${args.name}`,
  };
}

/** 重命名笔记本（只改名字，不动内容） */
export async function renameNotebook(
  client: SiYuanClient,
  args: { notebook: string; name: string }
): Promise<Record<string, unknown>> {
  await client.renameNotebook(args.notebook, args.name);
  return { notebook: args.notebook, name: args.name, message: 'Notebook renamed' };
}

/** 打开笔记本（让它出现在笔记树里） */
export async function openNotebook(
  client: SiYuanClient,
  args: { notebook: string }
): Promise<Record<string, unknown>> {
  await client.openNotebook(args.notebook);
  return { notebook: args.notebook, opened: true };
}

/** 关闭笔记本（仅从当前会话收起，不删除任何内容） */
export async function closeNotebook(
  client: SiYuanClient,
  args: { notebook: string }
): Promise<Record<string, unknown>> {
  await client.closeNotebook(args.notebook);
  return { notebook: args.notebook, closed: true };
}

/**
 * 移动文档到另一个笔记本/目录。
 * 只改变位置，不修改内容；但位置变化对用户是可感知的，因此描述里会说明。
 */
export async function moveDocuments(
  client: SiYuanClient,
  args: { fromNotebook: string; fromPath: string; toNotebook: string; toPath: string }
): Promise<Record<string, unknown>> {
  const res = await client.moveDocs({
    fromNotebook: args.fromNotebook,
    fromPath: args.fromPath,
    toNotebook: args.toNotebook,
    toPath: args.toPath,
  });
  return {
    id: res?.id ?? null,
    from: `${args.fromNotebook}:${args.fromPath}`,
    to: `${args.toNotebook}:${args.toPath}`,
    message: 'Document(s) moved',
  };
}

// ==================== 资源（Assets）====================

/**
 * 把资源路径解析成**本地绝对路径**（只读）。
 *
 * 注意：思源返回的是文件系统路径（如 `C:\...\data\assets\foo.png`），不是 HTTP URL。
 * 对不存在的资源会报错 —— 这是思源的行为，如实向上传递。
 */
export async function resolveAssetPath(
  client: SiYuanClient,
  args: { path: string }
): Promise<Record<string, unknown>> {
  const resolved = await client.resolveAssetPath(args.path);
  return {
    path: args.path,
    resolvedPath: resolved || null,
  };
}

/**
 * 列出**未被任何文档引用**的资源（只读）。
 * 注意：这里只列出来，不删除 —— 删除资源属于高危操作。
 */
export async function listUnusedAssets(
  client: SiYuanClient,
  _args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const items = await client.getUnusedAssets();
  const list = Array.isArray(items) ? items : [];
  return {
    count: list.length,
    assets: list.slice(0, 200),
    truncated: list.length > 200,
    note: 'This tool only lists assets; deleting them is a separate, destructive operation.',
  };
}

/**
 * 上传资源。
 *
 * ⚠️ 通过 MCP 传二进制不可行，因此 `files[].data` 应当是**文本**或 base64 字符串，
 * 适合上传小文本/小图标；大文件请直接把文件放进工作空间的 assets 目录。
 */
export async function uploadAsset(
  client: SiYuanClient,
  args: { assetsDirPath: string; files: Array<{ name: string; data: string }> }
): Promise<Record<string, unknown>> {
  const res = await client.uploadAsset({
    assetsDirPath: args.assetsDirPath,
    files: (args.files ?? []).map((file) => ({ name: file.name, data: file.data })),
  });
  return {
    succeeded: Object.keys(res?.succMap ?? {}).length,
    succMap: res?.succMap ?? {},
    errFiles: res?.errFiles ?? [],
  };
}

/**
 * 把**服务端文件系统上已有的**资源插入到某个块中。
 *
 * ⚠️ `assetPaths` 必须是**绝对路径**（例如
 * `C:\...\data\assets\foo.png`），不能传思源内部的 `assets/foo.png` ——
 * 实测后者会报 `GetFileAttributesEx ... The system cannot find the path specified`。
 * 若手上只有思源内部路径，先用 `resolve_asset_path` 换成绝对路径。
 */
export async function insertLocalAssets(
  client: SiYuanClient,
  args: { id: string; assetPaths: string[] }
): Promise<Record<string, unknown>> {
  await client.insertLocalAssets({ id: args.id, assetPaths: args.assetPaths ?? [] });
  return {
    id: args.id,
    inserted: (args.assetPaths ?? []).length,
    message: 'Local assets inserted',
  };
}

// ==================== 模板 ====================

/** 把某篇文档保存为模板（新增模板文件，不改原文） */
export async function saveAsTemplate(
  client: SiYuanClient,
  args: { id: string; name: string }
): Promise<Record<string, unknown>> {
  await client.docSaveAsTemplate(args.id, args.name);
  return { id: args.id, name: args.name, message: 'Saved as template' };
}

// ==================== 快照 ====================

/**
 * 创建快照（本地 / 云端）。
 * 这是**新增**操作，不会覆盖任何现有数据 —— 回滚才是危险的那个。
 *
 * 注意：实测思源的 `/api/snapshot/createSnapshot` **返回空 body**，
 * 不回传新建快照的 id（`/api/snapshot/getSnapshot` 同样为空）。
 * 因此这里无法给出 id —— 如实说明，而不是伪造一个。
 */
export async function createSnapshot(
  client: SiYuanClient,
  args: { name?: string; cloud?: boolean }
): Promise<Record<string, unknown>> {
  if (args.cloud) {
    await client.createCloudSnapshot(args.name);
    return {
      scope: 'cloud',
      name: args.name ?? null,
      message: 'Cloud snapshot created',
    };
  }

  const res = await client.createSnapshot(args.name);
  return {
    scope: 'local',
    id: res?.id ?? null,
    name: args.name ?? null,
    message: 'Snapshot created',
    note:
      '思源不返回新快照的 id（该接口返回空响应）。如需删除或回滚某个快照，' +
      '请在思源「数据历史 / 快照」界面查看具体 id。',
  };
}

// ==================== 书签 与 引用 ====================

/** 重命名书签 */
export async function renameBookmark(
  client: SiYuanClient,
  args: { id: string; name: string }
): Promise<Record<string, unknown>> {
  await client.renameBookmark(args.id, args.name);
  return { id: args.id, name: args.name, message: 'Bookmark renamed' };
}

/**
 * 把某个块的引用（锚文本）转移到另一个块。
 * 会改变引用指向 —— 不销毁内容，但属于"引用关系变更"，描述里会提醒。
 */
export async function transferBlockRef(
  client: SiYuanClient,
  args: { fromId: string; toId: string }
): Promise<Record<string, unknown>> {
  await client.transferBlockRef(args.fromId, args.toId);
  return { from: args.fromId, to: args.toId, message: 'Block reference transferred' };
}
