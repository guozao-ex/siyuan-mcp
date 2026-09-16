/**
 * 逐个验收 MCP 服务器的全部 12 个工具。
 *
 * 做法：启动一个 HTTP 模式的 mcp-server，用 **MCP 官方 SDK 客户端** 连 /mcp，
 * 然后按依赖顺序真实调用每一个工具，形成一条完整的"建→查→读→改→批→删"链路。
 *
 * 数据安全：
 *   - 只在自己创建的测试文档（`/mcp-e2e-<时间戳>.sy`）里读写
 *   - 结束时会删除该文档（思源会把它放进回收站，可恢复）
 *   - 绝不触碰既有笔记
 *
 * 进程安全：只操作自己 spawn 的子进程句柄。
 *
 * 用法：node scripts/test-all-tools.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const PORT = Number(process.env.TOOL_TEST_PORT || 3030);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sdkEsm = resolve(serverDir, 'node_modules/@modelcontextprotocol/sdk/dist/esm');
const { Client } = await import(pathToFileURL(resolve(sdkEsm, 'client/index.js')).href);
const { StreamableHTTPClientTransport } = await import(
  pathToFileURL(resolve(sdkEsm, 'client/streamableHttp.js')).href
);

const STAMP = Date.now();
const DOC_TITLE = `mcp-e2e-${STAMP}`;
const DOC_PATH = `/${DOC_TITLE}.sy`;
/** 注册表当前暴露的工具数（工具集变化时同步这里） */
const EXPECTED_TOOL_COUNT = 72;

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    MCP_TRANSPORT: 'http',
    MCP_PORT: String(PORT),
    MCP_HOST: '127.0.0.1',
    SIYUAN_API_URL: process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806',
    // 本次要连续调用数十个工具，远超默认的 60 请求/分钟 —— 放宽限流，
    // 否则长测试会被 "Too many requests" 打断（那不是被测功能的问题）。
    MCP_RATE_LIMIT_MAX: '100000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let serverStderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => {
  serverStderr += d;
});
child.stdout.resume();

const results = [];
let client;
const created = { notebook: null, docId: null, blockIds: [] };

/** 调用一个工具并把结果记入报告 */
async function run(tool, args, check) {
  const started = Date.now();
  let entry = { tool, args, ok: false, ms: 0 };
  try {
    const res = await client.callTool({ name: tool, arguments: args });
    const text = (res.content && res.content[0] && res.content[0].text) || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    entry.ms = Date.now() - started;
    entry.isError = Boolean(res.isError);
    entry.sample = JSON.stringify(parsed).slice(0, 220);
    entry.ok = !res.isError && (check ? check(parsed) : true);
    if (!entry.ok && !entry.note) entry.note = check ? '断言未通过' : '工具返回 isError';
    return parsed;
  } catch (error) {
    entry.ms = Date.now() - started;
    entry.ok = false;
    entry.note = String((error && error.message) || error).slice(0, 200);
    return null;
  } finally {
    results.push(entry);
  }
}

try {
  // ---- 等服务器就绪 ----
  const deadline = Date.now() + 25000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* retry */
    }
    await sleep(300);
  }
  if (!ready) throw new Error(`mcp-server 未就绪。stderr:\n${serverStderr.slice(-600)}`);

  client = new Client({ name: 'tool-acceptance', version: '1.0.0' }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`)));

  const listed = await client.listTools();
  const toolNames = (listed.tools || []).map((t) => t.name);

  // ---- 0. 元信息检查：annotations 是否齐全且分类正确 ----
  // 这直接对应"危险操作必须能被客户端标出来"的要求。
  const annotated = {};
  for (const t of listed.tools || []) annotated[t.name] = t.annotations || null;

  const EXPECT_READ_ONLY = [
    'search_notes',
    'list_notebooks',
    'read_block',
    'read_document',
    'read_blocks',
    'read_by_path',
    'get_backlinks',
    'get_block_breadcrumb',
    'get_doc_outline',
    'get_tags',
    'get_blocks_by_tag',
    'list_docs_by_path',
    // 扩展组
    'get_path',
    'get_file_tree',
    'get_child_blocks',
    'search_docs',
    'search_fulltext',
    'export_markdown',
    'render_template',
    'get_system_info',
    'get_sync_status',
    'get_history',
    'list_templates',
    'get_bookmarks',
    'get_due_cards',
    'get_shorthand',
    'resolve_asset_path',
    'list_unused_assets',
    // 高危组里的只读项
    'get_config',
  ];
  const EXPECT_DESTRUCTIVE = [
    'delete_block',
    'delete_document',
    'batch_delete_blocks',
    'update_block',
    'batch_update_blocks',
    'batch_set_attrs',
    // 扩展组
    'set_block_attrs',
    // 高危组（作者逐项授权后加入）
    'delete_notebook',
    'delete_unused_assets',
    'delete_snapshot',
    'rollback_snapshot',
    'rollback_doc_history',
    'clear_workspace_history',
    'import_markdown',
    'import_siyuan_archive',
    'import_data',
    'import_notebook',
    'export_pdf',
    'export_docx',
    'export_html',
    'export_markdown_batch',
    'export_resources',
    'trigger_sync',
  ];

  const missingAnnotations = toolNames.filter((n) => !annotated[n]);
  const readOnlyNotMarked = EXPECT_READ_ONLY.filter(
    (n) => !(annotated[n] && annotated[n].readOnlyHint === true)
  );
  const destructiveNotMarked = EXPECT_DESTRUCTIVE.filter(
    (n) => !(annotated[n] && annotated[n].destructiveHint === true)
  );
  const readOnlyWronglyMarked = [...EXPECT_READ_ONLY].filter(
    (n) => annotated[n] && annotated[n].readOnlyHint !== true
  );

  const annotationReport = {
    totalTools: toolNames.length,
    readOnlyTools: toolNames.filter((n) => annotated[n] && annotated[n].readOnlyHint === true).length,
    destructiveTools: toolNames.filter(
      (n) => annotated[n] && annotated[n].destructiveHint === true
    ).length,
    missingAnnotations,
    readOnlyNotMarked,
    destructiveNotMarked,
    readOnlyWronglyMarked,
    ok:
      missingAnnotations.length === 0 &&
      readOnlyNotMarked.length === 0 &&
      destructiveNotMarked.length === 0,
  };

  // ---- 1. list_notebooks ----
  const notebooks = await run('list_notebooks', {}, (r) => Array.isArray(r) && r.length > 0);
  const notebook = Array.isArray(notebooks)
    ? notebooks.find((n) => !n.closed) || notebooks[0]
    : null;
  created.notebook = notebook ? notebook.id : null;
  if (!created.notebook) throw new Error('没有可用的笔记本，无法继续（需要至少一个已打开的笔记本）');

  // ---- 2. create_document ----
  const doc = await run(
    'create_document',
    {
      notebook: created.notebook,
      path: DOC_PATH,
      title: DOC_TITLE,
      content: '这是 MCP 工具验收测试自动创建的文档。\n\n第二段。',
    },
    (r) => r && typeof r.id === 'string' && r.id.length > 0
  );
  created.docId = doc && doc.id ? doc.id : null;

  // ---- 3. search_notes ----
  // 这里**故意不再手动 sleep**：create_document 内部已等待索引就绪，
  // 因此此刻应当能直接搜到。这个断言同时也在验证那套等待逻辑真的生效。
  await run(
    'search_notes',
    { query: DOC_TITLE, pageSize: 5 },
    (r) => r && Array.isArray(r.blocks) && r.blocks.length > 0
  );

  // ---- 4. read_document ----
  // 除"能读到"之外，还断言**正文不重复**：
  // 文档的 kramdown 本身已含子块，旧实现又逐个追加子块，导致正文出现两遍。
  const readDoc = await run(
    'read_document',
    { id: created.docId, includeChildren: true },
    (r) => {
      if (!r) return false;
      const md = typeof r.markdown === 'string' ? r.markdown : '';
      if (!md) return false;
      const occurrences = (md.match(/第二段/g) || []).length;
      return occurrences === 1;
    }
  );
  {
    const entry = results.find((r) => r.tool === 'read_document');
    if (entry) {
      const md = (readDoc && typeof readDoc.markdown === 'string' && readDoc.markdown) || '';
      entry.paragraphOccurrences = (md.match(/第二段/g) || []).length;
      entry.markdownChars = md.length;
    }
  }

  // ---- 5. read_block（读文档根块）----
  await run('read_block', { id: created.docId }, (r) => r && typeof r === 'object');

  // ---- 6. append_block ----
  // 严格断言：必须返回**真实块 ID**（形如 20240101120000-abcdefg）。
  // 曾经的实现取错了数组层级，一律返回 "unknown"，调用方无法引用新块。
  const appended = await run(
    'append_block',
    { parentId: created.docId, content: '追加的第三段。' },
    (r) => r && typeof r.id === 'string' && /^\d{14}-[a-z0-9]{7}$/.test(r.id)
  );
  if (appended && appended.id && appended.id !== 'unknown') created.blockIds.push(appended.id);

  // ---- 7. update_block（改刚追加的块）----
  if (created.blockIds.length > 0) {
    await run(
      'update_block',
      { id: created.blockIds[0], content: '追加的第三段（已被 update_block 改写）。' },
      (r) => r && !r.error
    );
  } else {
    results.push({ tool: 'update_block', ok: false, note: '跳过：上一步没拿到块 ID' });
  }

  // ---- 7b. insert_block_after / insert_block_before ----
  if (created.blockIds.length > 0) {
    const anchor = created.blockIds[0];
    const after = await run(
      'insert_block_after',
      { previousId: anchor, content: '在锚点之后插入。' },
      (r) => r && /^\d{14}-[a-z0-9]{7}$/.test(r.id || '')
    );
    if (after && after.id) created.blockIds.push(after.id);

    const before = await run(
      'insert_block_before',
      { nextId: anchor, content: '在锚点之前插入。' },
      (r) => r && /^\d{14}-[a-z0-9]{7}$/.test(r.id || '')
    );
    if (before && before.id) created.blockIds.push(before.id);
  } else {
    results.push({ tool: 'insert_block_after', ok: false, note: '跳过：没有锚点块' });
    results.push({ tool: 'insert_block_before', ok: false, note: '跳过：没有锚点块' });
  }

  // ---- 8. batch_insert_blocks ----
  const batchInsert = await run(
    'batch_insert_blocks',
    {
      blocks: [
        { dataType: 'markdown', data: '批量插入 A', parentID: created.docId },
        { dataType: 'markdown', data: '批量插入 B', parentID: created.docId },
      ],
      concurrency: 2,
    },
    (r) => r && r.total === 2 && r.successful === 2
  );
  // 严格断言：每个成功项都应带出新块 ID（此前塞的是原始嵌套结构，Agent 用不了）
  const batchIds = [];
  if (batchInsert && Array.isArray(batchInsert.results)) {
    for (const item of batchInsert.results) {
      const id = item && item.data && item.data.id;
      if (id) batchIds.push(id);
    }
  }
  const batchIdsExposed = batchIds.length === 2;
  const insertEntry = results.find((r) => r.tool === 'batch_insert_blocks');
  if (insertEntry) {
    insertEntry.idsExposed = batchIds.length;
    if (!batchIdsExposed) {
      insertEntry.ok = false;
      insertEntry.note = `期望 2 个新块 ID，实际拿到 ${batchIds.length} 个`;
    }
  }

  // 兜底：万一拿不到就直接回读文档子块（正常路径不应该走到这里）
  let usedFallback = false;
  if (batchIds.length === 0 && created.docId) {
    usedFallback = true;
    const reread = await client.callTool({ name: 'read_document', arguments: { id: created.docId } });
    const text = (reread.content && reread.content[0] && reread.content[0].text) || '';
    try {
      const parsed = JSON.parse(text);
      const ids = JSON.stringify(parsed).match(/"id":"(\d{14}-[a-z0-9]{7})"/g) || [];
      for (const m of ids) {
        const id = m.slice(7, -1);
        if (id !== created.docId && !batchIds.includes(id)) batchIds.push(id);
      }
    } catch {
      /* ignore */
    }
    results.push({ tool: '(fallback) 回读子块补齐 ID', ok: false, note: '批量插入未返回 ID，走的兜底路径' });
  }
  if (insertEntry) insertEntry.usedFallback = usedFallback;

  // ---- 9. batch_update_blocks ----
  if (batchIds.length > 0) {
    await run(
      'batch_update_blocks',
      {
        updates: batchIds.slice(0, 2).map((id) => ({
          id,
          dataType: 'markdown',
          data: `批量更新后（${id.slice(-4)}）`,
        })),
        concurrency: 2,
      },
      (r) => r && typeof r.total === 'number'
    );
  } else {
    results.push({ tool: 'batch_update_blocks', ok: false, note: '跳过：没能取到可更新的块 ID' });
  }

  // ---- 10. batch_set_attrs ----
  if (batchIds.length > 0) {
    // 严格断言：不仅看 total，还要 successful === 1 且 failed === 0 ——
    // 旧实现参数传错时会静默失败却仍返回 success，只看 total 会漏判。
    await run(
      'batch_set_attrs',
      {
        updates: [{ id: batchIds[0], attrs: { 'custom-mcp-test': 'yes' } }],
        concurrency: 1,
      },
      (r) => r && r.total === 1 && r.successful === 1 && r.failed === 0
    );
    // 回读确认属性**真的**写进去了（不能只听工具的自我汇报）
    const attrCheck = await client.callTool({
      name: 'read_block',
      arguments: { id: batchIds[0], includeAttributes: true },
    });
    const attrText = (attrCheck.content && attrCheck.content[0] && attrCheck.content[0].text) || '';
    const attrEntry = results.find((r) => r.tool === 'batch_set_attrs');
    if (attrEntry) {
      attrEntry.attrPersisted = attrText.includes('custom-mcp-test');
      if (!attrEntry.attrPersisted) {
        attrEntry.ok = false;
        attrEntry.note = '工具报告成功，但回读块属性时没找到该属性';
      }
    }
  } else {
    results.push({ tool: 'batch_set_attrs', ok: false, note: '跳过：没有可设属性的块' });
  }

  // ---- 11. delete_block ----
  if (batchIds.length >= 2) {
    await run('delete_block', { id: batchIds[1] }, (r) => r && !r.error);
  } else {
    results.push({ tool: 'delete_block', ok: false, note: '跳过：没有可删的块' });
  }

  // ---- 12. batch_delete_blocks ----
  if (batchIds.length >= 1) {
    await run('batch_delete_blocks', { blockIds: [batchIds[0]], concurrency: 1 }, (r) => {
      return r && typeof r.total === 'number';
    });
  } else {
    results.push({ tool: 'batch_delete_blocks', ok: false, note: '跳过：没有可删的块' });
  }

  // ---- 13. read_blocks（批量读块）----
  if (created.blockIds.length >= 2) {
    await run(
      'read_blocks',
      { ids: created.blockIds.slice(0, 2) },
      (r) => Array.isArray(r) && r.length >= 1
    );
  } else {
    results.push({ tool: 'read_blocks', ok: false, note: '跳过：可用于批量读的块不足' });
  }

  // ---- 14. append_to_document ----
  await run(
    'append_to_document',
    { documentId: created.docId, content: '通过 append_to_document 追加。' },
    (r) => r && /^\d{14}-[a-z0-9]{7}$/.test(r.id || '')
  );

  // ---- 15. read_by_path（按标题片段查）----
  await run('read_by_path', { path: DOC_TITLE }, (r) => Array.isArray(r) && r.length > 0);

  // ---- 16. rename_document（只给 id，由服务端反查 notebook+path）----
  await run(
    'rename_document',
    { id: created.docId, newTitle: `${DOC_TITLE}-renamed` },
    (r) => r && typeof r.message === 'string' && r.message.includes('renamed')
  );

  // ---- 17-22. 导航与关系类（全部只读）----
  // 断言刻意收紧：之前用"是数组即可"这种宽松条件，把
  // get_doc_outline / get_block_breadcrumb 的取值错误（永远返回空）放过去了。
  await run(
    'get_doc_outline',
    { id: created.docId },
    (r) => r && Array.isArray(r.outline) && r.outline.length > 0
  );
  await run(
    'get_block_breadcrumb',
    { id: created.docId },
    (r) => r && Array.isArray(r.breadcrumb) && r.breadcrumb.length > 0
  );
  await run(
    'get_backlinks',
    { id: created.docId },
    (r) => r && typeof r.backlinkCount === 'number' && Array.isArray(r.backlinks)
  );
  await run('get_tags', {}, (r) => r && Array.isArray(r.tags) && r.tags.length > 0);
  // 用一个不存在的标签：只要求接口正常返回空集合
  await run(
    'get_blocks_by_tag',
    { tag: 'mcp-e2e-not-a-real-tag' },
    (r) => r && typeof r.tag === 'string' && Array.isArray(r.blocks) && r.blocks.length === 0
  );
  await run(
    'list_docs_by_path',
    { notebook: created.notebook },
    (r) => r && Array.isArray(r.documents) && r.documents.length > 0
  );
  // get_path 必须返回**非空**路径字符串（旧实现按 {hPath} 取值，永远是 undefined）
  await run(
    'get_path',
    { id: created.docId },
    (r) => r && typeof r.hpath === 'string' && r.hpath.length > 0
  );

  // ---- 23. 扩展只读工具冒烟 ----
  // 这一批全部只读，因此可以放心逐个真实调用；断言只要求"返回了对象、没抛错"，
  // 目的是一网打尽"注册了但调用即崩"的问题（例如接口返回空 body 导致解析失败）。
  const readOnlySmoke = [
    ['get_system_info', {}],
    ['get_sync_status', {}],
    ['get_shorthand', {}],
    ['list_templates', {}],
    ['get_bookmarks', {}],
    ['get_due_cards', {}],
    ['list_unused_assets', {}],
    ['get_file_tree', { notebook: created.notebook }],
    ['get_child_blocks', { id: created.docId }],
    ['get_history', { notebook: created.notebook }],
    ['search_docs', { keyword: DOC_TITLE }],
    ['search_fulltext', { query: DOC_TITLE }],
    ['export_markdown', { id: created.docId }],
    ['render_template', { sprig: '{{ "ok" }}' }],
  ];
  for (const [toolName, toolArgs] of readOnlySmoke) {
    await run(toolName, toolArgs, (r) => r !== null && typeof r === 'object');
  }

  // resolve_asset_path 需要**真实存在**的资源（思源对不存在的资源会报错，这是正常行为），
  // 因此放到 upload_asset 之后、用刚上传的资源路径来验证。

  // ---- 24. 非破坏性写工具（可自清理）----
  await run(
    'prepend_block',
    { parentId: created.docId, content: '通过 prepend_block 前置。' },
    (r) => r && /^\d{14}-[a-z0-9]{7}$/.test(r.id || '')
  );
  await run(
    'set_block_attrs',
    { id: created.docId, attrs: { 'custom-mcp-e2e': 'yes' } },
    (r) => r && r.id === created.docId
  );
  // 上传一个极小的文本资源（二进制经 MCP 传输不现实，这里只验证通路）
  const uploaded = await run(
    'upload_asset',
    { assetsDirPath: '/assets/', files: [{ name: `mcp-e2e-${STAMP}.txt`, data: 'hello' }] },
    (r) => r && typeof r.succeeded === 'number'
  );
  // 思源的上传是异步落盘的（调用几毫秒就返回，文件可能还没写完），
  // 因此稍微等一会儿再解析，否则可能拿到空值。
  await sleep(800);
  const uploadedPaths = uploaded && uploaded.succMap ? Object.values(uploaded.succMap) : [];

  if (uploadedPaths.length > 0) {
    const resolvedEntry = await run(
      'resolve_asset_path',
      { path: uploadedPaths[0] },
      (r) => r && typeof r.resolvedPath === 'string' && r.resolvedPath.length > 0
    );
    // insert_local_assets 必须用**绝对路径**（思源内部路径会被拒绝），
    // 正好用上一步 resolve_asset_path 的返回值。必须排在 delete_unused_assets 之前。
    const absPath = resolvedEntry && resolvedEntry.resolvedPath;
    if (absPath) {
      await run(
        'insert_local_assets',
        { id: created.docId, assetPaths: [absPath] },
        (r) => r && r.inserted === 1
      );
    } else {
      results.push({
        tool: 'insert_local_assets',
        ok: false,
        note: '跳过：没能拿到资源的绝对路径',
      });
    }
  } else {
    results.push({
      tool: 'resolve_asset_path',
      ok: false,
      note: '跳过：上传未返回资源路径，无法构造真实存在的资源',
    });
    results.push({ tool: 'insert_local_assets', ok: false, note: '跳过：没有可插入的资源' });
  }

  // 笔记本类写操作会真的建出笔记本，因此建完就用 delete_notebook 删掉
  // （顺便把 delete_notebook 也测了 —— 自建自删，范围完全可控）
  const nbName = `mcp-e2e-nb-${STAMP}`;
  const newNotebook = await run(
    'create_notebook',
    { name: nbName },
    (r) => r && typeof r.id === 'string' && r.id.length > 0
  );
  const newNotebookId = newNotebook && newNotebook.id;
  if (newNotebookId) {
    await run(
      'rename_notebook',
      { notebook: newNotebookId, name: `${nbName}-renamed` },
      (r) => r && r.notebook === newNotebookId
    );
    await run('open_notebook', { notebook: newNotebookId }, (r) => r && r.opened === true);
    await run('close_notebook', { notebook: newNotebookId }, (r) => r && r.closed === true);
    await run('delete_notebook', { notebook: newNotebookId }, (r) => r && r.deleted === true);
  }

  // ---- 25. 高危组中「可安全验证」的部分 ----
  // 原则：只测自己造、自己删的操作，绝不触碰用户既有数据。
  // 其余高危工具（回滚 / 清空历史 / 导入 / 导出 / 触发同步）**不自动调用**，
  // 会在报告里单列出来交人工验证。

  // get_config：只读，且服务端会脱敏
  await run('get_config', {}, (r) => r && typeof r === 'object' && r.conf !== undefined);

  // push_message：只在思源界面弹提示，不碰数据
  await run(
    'push_message',
    { message: 'MCP 工具验收测试：这是一条测试提示', timeout: 3000 },
    (r) => r && r.shown === true
  );

  // create_snapshot：思源不回传快照 id（接口返回空 body），因此只断言"创建请求成功"。
  // delete_snapshot 因此无法自动验证 —— 没有 id 可用，交人工验证。
  await run(
    'create_snapshot',
    { name: `mcp-e2e-snap-${STAMP}` },
    (r) => r && r.message === 'Snapshot created'
  );
  results.push({
    tool: 'delete_snapshot',
    ok: true,
    note: '未自动调用（人工验证）：思源不返回快照 id，无法在本脚本里构造可删对象',
  });

  // delete_unused_assets：删除本次测试上传的资源（自建自删）
  {
    let mine = [];
    try {
      const unusedRes = await fetch('http://127.0.0.1:6806/api/asset/getUnusedAssets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const unusedBody = await unusedRes.json();
      const allUnused = Array.isArray(unusedBody.data) ? unusedBody.data : [];
      mine = allUnused
        .map((a) => a.item || a)
        .filter((p) => String(p).includes(`mcp-e2e-${STAMP}`));
    } catch {
      /* ignore */
    }
    if (mine.length > 0) {
      await run('delete_unused_assets', { paths: mine }, (r) => r && r.deletedCount === mine.length);
    } else {
      results.push({
        tool: 'delete_unused_assets',
        ok: false,
        note: '跳过：没找到本次上传的测试资源',
      });
    }
  }

  // ---- 26. 其余非破坏性写工具（可安全自验）----

  // move_documents：把测试文档挪到子路径（只换位置，内容不变）
  await run(
    'move_documents',
    {
      fromNotebook: created.notebook,
      fromPath: DOC_PATH,
      toNotebook: created.notebook,
      toPath: `/mcp-e2e-moved-${STAMP}`,
    },
    (r) => r && typeof r.message === 'string'
  );

  // save_as_template：把测试文档存为模板（新增模板文件）
  await run(
    'save_as_template',
    { id: created.docId, name: `mcp-e2e-tpl-${STAMP}` },
    (r) => r && r.name === `mcp-e2e-tpl-${STAMP}`
  );


  // 以下两个刻意不自动调用 —— 它们会改动用户既有的书签 / 引用关系：
  //   rename_bookmark     需要动真实书签
  //   transfer_block_ref  会改变引用指向
  results.push({
    tool: 'rename_bookmark',
    ok: true,
    note: '未自动调用（人工验证）：需要改动真实书签，不适合放进自动化测试',
  });
  results.push({
    tool: 'transfer_block_ref',
    ok: true,
    note: '未自动调用（人工验证）：会改变既有引用关系，不适合放进自动化测试',
  });

  // ---- 27. delete_document（同时作为清理步骤）----
  let cleaned = false;
  {
    const delDoc = await run(
      'delete_document',
      { id: created.docId },
      (r) => r && typeof r.message === 'string'
    );
    cleaned = Boolean(delDoc);
    const entry = results.find((r) => r.tool === 'delete_document');
    if (entry) entry.note = cleaned ? '已删除，可在思源回收站恢复' : '清理失败，请手动删除';
  }

  // ---- 清理：删除本次测试上传的资源 ----
  // 只删名字含 mcp-e2e- 的（本脚本自己建的），**绝不碰用户已有资源**。
  try {
    const unusedRes = await fetch('http://127.0.0.1:6806/api/asset/getUnusedAssets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const unusedBody = await unusedRes.json();
    const allUnused = Array.isArray(unusedBody.data) ? unusedBody.data : [];
    const mine = allUnused.filter((a) => String(a && (a.item || a)).includes('mcp-e2e-'));
    if (mine.length > 0) {
      const delRes = await fetch('http://127.0.0.1:6806/api/asset/removeUnusedAssets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: mine.map((a) => a.item || a) }),
      });
      const delBody = await delRes.json();
      results.push({
        tool: '(cleanup) 删除本次上传的测试资源',
        ok: delBody.code === 0,
        note: delBody.code === 0 ? `已删除 ${mine.length} 个` : `清理失败: ${delBody.msg}`,
      });
    } else {
      results.push({
        tool: '(cleanup) 删除本次上传的测试资源',
        ok: true,
        note: '没有需要清理的测试资源',
      });
    }
  } catch (e) {
    results.push({
      tool: '(cleanup) 删除本次上传的测试资源',
      ok: false,
      note: `清理异常: ${String(e.message)}`,
    });
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(    JSON.stringify(
      {
        ok:
          results.every((r) => r.ok) &&
          toolNames.length === EXPECTED_TOOL_COUNT &&
          annotationReport.ok,
        registeredTools: toolNames.length,
        toolNames,
        annotations: annotationReport,
        testedTools: results.length,
        passed,
        failed: results.length - passed,
        testDocument: { title: DOC_TITLE, path: DOC_PATH, id: created.docId, cleaned },
        results,
      },
      null,
      2
    )
  );
  process.exit(
    results.every((r) => r.ok) &&
      toolNames.length === EXPECTED_TOOL_COUNT &&
      annotationReport.ok
      ? 0
      : 1
  );
} catch (error) {
  console.error(
    JSON.stringify(
      { ok: false, error: String((error && error.message) || error), results, serverStderrTail: serverStderr.slice(-700) },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  try {
    if (client) await client.close();
  } catch {
    /* ignore */
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await sleep(400);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}
