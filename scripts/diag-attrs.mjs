/**
 * 诊断：为什么 batch_set_attrs 写进去的属性，read_block(includeAttributes) 读不到。
 * 直接打印 read_block 的原始返回，而不是靠断言猜。
 *
 * 用法：node scripts/diag-attrs.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const PORT = 3031;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NB = '20260908171101-6qexn7m';

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: { ...process.env, MCP_TRANSPORT: 'http', MCP_PORT: String(PORT), MCP_HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
child.stderr.resume();
child.stdout.resume();

const call = async (name, args) => {
  const res = await fetch(`${BASE}/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: args }),
  });
  const body = await res.json();
  const text = (body.content && body.content[0] && body.content[0].text) || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, isError: Boolean(body.isError), parsed };
};

try {
  const deadline = Date.now() + 25000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* retry */
    }
    await sleep(300);
  }
  if (!ready) throw new Error('服务器未就绪');

  const doc = await call('create_document', {
    notebook: NB,
    path: `/diag-attr2-${Date.now()}.sy`,
    title: `diag-attr2-${Date.now()}`,
    content: 'attr target',
  });
  const docId = doc.parsed.id;
  console.log('docId =', docId);

  const appended = await call('append_block', { parentId: docId, content: 'attribute target block' });
  const blockId = appended.parsed.id;
  console.log('blockId =', blockId);

  const setRes = await call('batch_set_attrs', {
    updates: [{ id: blockId, attrs: { 'custom-diag': 'v1' } }],
    concurrency: 1,
  });
  console.log('\n=== batch_set_attrs 返回 ===');
  console.log(JSON.stringify(setRes.parsed, null, 2));

  const readRes = await call('read_block', { id: blockId, includeAttributes: true });
  console.log('\n=== read_block(includeAttributes) 原始返回 ===');
  console.log(JSON.stringify(readRes.parsed, null, 2));

  const readNoAttr = await call('read_block', { id: blockId });
  console.log('\n=== read_block(不带属性) 返回的字段名 ===');
  console.log(Object.keys(readNoAttr.parsed || {}).join(', '));

  await call('delete_block', { id: docId });
  console.log('\ncleaned');
} catch (error) {
  console.error('diagnose failed:', String((error && error.message) || error));
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await sleep(300);
  }
}
