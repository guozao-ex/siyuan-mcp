/**
 * 验证 HTTP 模式下的工具集与分派。
 *
 * 要验证的核心命题（P1-2 重构目标）：
 *   1. GET /tools 返回的工具集与 stdio 模式**完全一致**（此前硬编码 8 个，缺 4 个 batch 工具）
 *   2. POST /tools/call 能分派到 batch 工具（此前 switch 里没有，会返回 400 Unknown tool）
 *   3. 未知工具仍然返回 400
 *
 * 进程安全：只操作自己 spawn 的子进程句柄。
 *
 * 用法：node scripts/verify-http.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const PORT = Number(process.env.VERIFY_HTTP_PORT || 3010);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXPECTED = [
  'search_notes',
  'list_notebooks',
  'read_block',
  'read_document',
  'create_document',
  'update_block',
  'append_block',
  'delete_block',
  'batch_insert_blocks',
  'batch_update_blocks',
  'batch_delete_blocks',
  'batch_set_attrs',
  'read_blocks',
  'read_by_path',
  'insert_block_after',
  'insert_block_before',
  'append_to_document',
  'rename_document',
  'delete_document',
  'get_backlinks',
  'get_block_breadcrumb',
  'get_doc_outline',
  'get_tags',
  'get_blocks_by_tag',
  'list_docs_by_path',
  'get_backlinks',
  'get_block_breadcrumb',
  'get_doc_outline',
  'get_tags',
  'get_blocks_by_tag',
  'list_docs_by_path',
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
  'prepend_block',
  'create_notebook',
  'rename_notebook',
  'open_notebook',
  'close_notebook',
  'move_documents',
  'upload_asset',
  'insert_local_assets',
  'save_as_template',
  'create_snapshot',
  'rename_bookmark',
  'transfer_block_ref',
  'set_block_attrs',
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
  'get_config',
  'push_message',
];

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    MCP_TRANSPORT: 'http',
    MCP_PORT: String(PORT),
    MCP_HOST: '127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => {
  stderr += d;
});
child.stdout.setEncoding('utf8');
child.stdout.on('data', () => {
  /* HTTP 模式下 stdout 不用于协议，这里不关心 */
});

const exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed = null;
  const text = await res.text();
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 200);
  }
  return { status: res.status, body: parsed };
}

let result;
try {
  // ---- 等待服务就绪 ----
  const deadline = Date.now() + 25000;
  let ready = false;
  while (Date.now() < deadline) {
    const gone = await Promise.race([exited, sleep(300).then(() => null)]);
    if (gone) throw new Error(`服务器提前退出 ${JSON.stringify(gone)}\n${stderr.slice(-500)}`);
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* 还没起来 */
    }
  }
  if (!ready) throw new Error('等待 /health 就绪超时');

  // ---- 1. GET /tools ----
  const toolsRes = await fetch(`${BASE}/tools`);
  const toolsBody = await toolsRes.json();
  const names = toolsBody.tools || [];

  // ---- 2. 调用一个普通工具（验证分派真的能打通到思源） ----
  const listNotebooks = await post('/tools/call', {
    name: 'list_notebooks',
    arguments: {},
  });

  // ---- 3. 调用一个 batch 工具（重构前这里会 400 Unknown tool） ----
  //       传空 updates：setBlockAttrsBatch([]) 是纯空操作，不会调用任何思源 API
  const batchCall = await post('/tools/call', {
    name: 'batch_set_attrs',
    arguments: { updates: [] },
  });

  // ---- 4. 未知工具仍应 400 ----
  const unknown = await post('/tools/call', {
    name: 'definitely_not_a_tool',
    arguments: {},
  });

  const missing = EXPECTED.filter((n) => !names.includes(n));
  const extra = names.filter((n) => !EXPECTED.includes(n));

  result = {
    ok:
      missing.length === 0 &&
      extra.length === 0 &&
      unknown.status === 400 &&
      batchCall.status !== 400 &&
      listNotebooks.status === 200,
    toolsEndpoint: {
      status: toolsRes.status,
      count: names.length,
      missing: missing,
      extra: extra,
      includesBatchTools: names.filter((n) => n.startsWith('batch_')),
    },
    callNormalTool: {
      tool: 'list_notebooks',
      status: listNotebooks.status,
      isError: Boolean(listNotebooks.body && listNotebooks.body.isError),
      preview: JSON.stringify(listNotebooks.body).slice(0, 220),
    },
    callBatchTool: {
      tool: 'batch_set_attrs',
      status: batchCall.status,
      unknownToolError: JSON.stringify(batchCall.body).includes('Unknown tool'),
      preview: JSON.stringify(batchCall.body).slice(0, 220),
    },
    callUnknownTool: {
      status: unknown.status,
      body: unknown.body,
    },
  };
} catch (e) {
  result = { ok: false, error: String((e && e.message) || e), stderrTail: stderr.slice(-800) };
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await sleep(400);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
