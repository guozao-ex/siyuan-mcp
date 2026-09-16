/**
 * 验证 MCP 服务器在 stdio 模式下的协议通道干净度。
 *
 * 要验证的核心命题：
 *   stdio 模式下 stdout 只能承载 JSON-RPC 消息，任何非 JSON 输出都会破坏与
 *   MCP 客户端（如 Claude Desktop）的通信。
 *
 * 做法：用 Node 直接 spawn 服务器，完成一次真实的 MCP 握手
 *   initialize -> notifications/initialized -> tools/list
 * 然后逐行检查 stdout 是否**全部**是合法 JSON-RPC。
 *
 * 关于进程安全：本脚本只操作自己 spawn 出来的子进程句柄（child.kill()），
 * 不做任何系统级进程查找或批量结束，因此不会波及其他 Node 进程。
 *
 * 用法：node scripts/verify-stdio.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: { ...process.env, MCP_TRANSPORT: 'stdio' },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (d) => {
  stdout += d;
});
child.stderr.on('data', (d) => {
  stderr += d;
});

const exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));
const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);

const responses = new Map();
function harvest() {
  for (const line of stdout.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && obj.id !== undefined) responses.set(obj.id, obj);
    } catch {
      /* 非 JSON 行留给后面的统计 */
    }
  }
}

async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    harvest();
    if (fn()) return true;
    const gone = await Promise.race([exited, sleep(150).then(() => null)]);
    if (gone) throw new Error(`服务器提前退出 (${JSON.stringify(gone)})，阶段：${label}`);
  }
  return false;
}

let result;
try {
  // ---- 1. 等服务器进入 stdio 模式 ----
  const ready = await waitFor(() => /running on stdio/i.test(stderr), 20000, 'wait-ready');
  if (!ready) throw new Error('等待 "running on stdio" 超时');

  // ---- 2. MCP 握手 ----
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'verify-stdio', version: '1.0.0' },
    },
  });
  const initOk = await waitFor(() => responses.has(1), 10000, 'initialize');

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const toolsOk = await waitFor(() => responses.has(2), 10000, 'tools/list');

  // ---- 3. 逐行检查 stdout ----
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const nonJson = [];
  let jsonCount = 0;
  for (const line of lines) {
    try {
      JSON.parse(line);
      jsonCount += 1;
    } catch {
      nonJson.push(line);
    }
  }

  const init = responses.get(1);
  const tools = responses.get(2);
  const toolList = (tools && tools.result && tools.result.tools) || [];

  result = {
    ok: nonJson.length === 0 && initOk && toolsOk,
    stdout: {
      totalLines: lines.length,
      jsonRpcLines: jsonCount,
      nonJsonLines: nonJson.length,
      nonJsonSamples: nonJson.slice(0, 5),
    },
    stderrBytes: stderr.length,
    handshake: {
      initializeResponded: initOk,
      serverInfo: (init && init.result && init.result.serverInfo) || null,
      protocolVersion: (init && init.result && init.result.protocolVersion) || null,
      toolsListResponded: toolsOk,
      toolCount: toolList.length,
      toolNames: toolList.map((t) => t.name),
    },
    stderrHasConfigBanner: /MCP Server Configuration/.test(stderr),
  };
} catch (e) {
  result = {
    ok: false,
    error: String((e && e.message) || e),
    stdoutRaw: stdout.slice(0, 600),
    stderrTail: stderr.slice(-900),
  };
} finally {
  // 只结束自己 spawn 的子进程
  try {
    child.stdin.end();
  } catch {
    /* ignore */
  }
  await sleep(250);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await sleep(400);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
