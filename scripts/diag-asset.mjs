/**
 * 诊断：resolve_asset_path 工具返回 null，但直连思源 API 返回正常路径。
 * 目的：找出工具链路与直连之间的差异。
 *
 * 用法：node scripts/diag-asset.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const PORT = 3034;
const BASE = `http://127.0.0.1:${PORT}`;
const SIYUAN = 'http://127.0.0.1:6806';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: { ...process.env, MCP_TRANSPORT: 'http', MCP_PORT: String(PORT), MCP_HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
child.stderr.resume();
child.stdout.resume();

const callTool = async (name, args) => {
  const res = await fetch(`${BASE}/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: args }),
  });
  const body = await res.json();
  const text = (body.content && body.content[0] && body.content[0].text) || '';
  return { isError: Boolean(body.isError), text };
};

const callSiyuan = async (endpoint, payload) => {
  const res = await fetch(`${SIYUAN}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.text();
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

  const stamp = Date.now();

  console.log('=== 1) 通过工具上传资源 ===');
  const up = await callTool('upload_asset', {
    assetsDirPath: '/assets/',
    files: [{ name: `diag-${stamp}.txt`, data: 'hello' }],
  });
  console.log('  ', up.text.slice(0, 300));
  const succMap = JSON.parse(up.text).succMap || {};
  const assetPath = Object.values(succMap)[0];
  console.log('   解析出的资源路径:', assetPath);

  if (!assetPath) throw new Error('上传未返回资源路径，无法继续');

  // 分别在不同延迟下测试，定位是不是"文件尚未落盘"
  for (const waitMs of [0, 500, 1500]) {
    if (waitMs) await sleep(waitMs);
    console.log(`\n=== 2) 等待累计 ${waitMs}ms 后 ===`);

    const viaTool = await callTool('resolve_asset_path', { path: assetPath });
    console.log('   工具:', viaTool.isError ? 'ERROR' : 'OK', '->', viaTool.text.slice(0, 220));

    const viaApi = await callSiyuan('/api/asset/resolveAssetPath', { path: assetPath });
    console.log('   直连:', viaApi.slice(0, 220));
  }

  // 清理
  const unusedRaw = await callSiyuan('/api/asset/getUnusedAssets', {});
  const unused = JSON.parse(unusedRaw).data || [];
  const mine = unused.filter((a) => String(a.item || a).includes(`diag-${stamp}`));
  if (mine.length) {
    const del = await callSiyuan('/api/asset/removeUnusedAssets', {
      paths: mine.map((a) => a.item || a),
    });
    console.log('\n清理测试资源:', del.slice(0, 120));
  }
} catch (error) {
  console.error('诊断失败:', String((error && error.message) || error));
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await sleep(300);
  }
}
