/**
 * 验证 HTTP 模式的 Token 认证（P1-4）。
 *
 * 覆盖：
 *   A. 配置了 MCP_AUTH_TOKEN 时：
 *      1. GET /health 免认证 -> 200
 *      2. POST /tools/call 不带 token -> 401
 *      3. POST /tools/call 带错误 token -> 401
 *      4. POST /tools/call 带正确 token -> 200 且真实返回数据
 *      5. POST /mcp（标准端点）不带 token -> 401
 *      6. POST /mcp 带正确 token -> 200（标准端点同样受保护）
 *   B. MCP_HOST 为非回环地址且未配置 token -> 进程拒绝启动（非 0 退出码）
 *
 * 进程安全：只操作自己 spawn 的子进程句柄。
 *
 * 用法：node scripts/verify-auth.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const TOKEN = 'test-token-123';
const PORT = Number(process.env.VERIFY_AUTH_PORT || 3012);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch(env) {
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: serverDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => {
    stderr += d;
  });
  child.stdout.resume();
  child.getStderr = () => stderr;
  child.exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));
  return child;
}

async function waitHealthy(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  return false;
}

function stop(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
  }
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // MCP Streamable HTTP 规范要求客户端声明可接受的响应类型；
      // 缺少该头时服务端会按规范返回 406。
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 160);
  }
  return { status: res.status, body: parsed };
}

const initializePayload = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'verify-auth', version: '1.0.0' },
  },
};

let result;
let child;
let childB;
try {
  // ================= 场景 A：启用认证 =================
  child = launch({
    MCP_TRANSPORT: 'http',
    MCP_PORT: String(PORT),
    MCP_HOST: '127.0.0.1',
    MCP_AUTH_TOKEN: TOKEN,
  });

  if (!(await waitHealthy())) {
    throw new Error(`服务器未就绪。stderr:\n${child.getStderr().slice(-700)}`);
  }

  const health = await fetch(`${BASE}/health`);
  const noToken = await post('/tools/call', { name: 'list_notebooks', arguments: {} });
  const badToken = await post(
    '/tools/call',
    { name: 'list_notebooks', arguments: {} },
    { Authorization: 'Bearer wrong-token' }
  );
  const goodToken = await post(
    '/tools/call',
    { name: 'list_notebooks', arguments: {} },
    { Authorization: `Bearer ${TOKEN}` }
  );
  const mcpNoToken = await post('/mcp', initializePayload);
  const mcpWithToken = await post('/mcp', initializePayload, { Authorization: `Bearer ${TOKEN}` });

  result = {
    scenarioA: {
      healthNoToken: { status: health.status, expected: 200 },
      restNoToken: { status: noToken.status, expected: 401, body: noToken.body },
      restWrongToken: { status: badToken.status, expected: 401 },
      restGoodToken: {
        status: goodToken.status,
        expected: 200,
        isError: Boolean(goodToken.body && goodToken.body.isError),
      },
      mcpNoToken: { status: mcpNoToken.status, expected: 401 },
      mcpWithToken: { status: mcpWithToken.status, expected: 200 },
    },
  };

  stop(child);
  await sleep(500);

  // ================= 场景 B：对外地址 + 无 token -> 拒绝启动 =================
  childB = launch({
    MCP_TRANSPORT: 'http',
    MCP_PORT: String(PORT + 1),
    MCP_HOST: '0.0.0.0',
    MCP_AUTH_TOKEN: '',
  });
  const exitB = await Promise.race([childB.exited, sleep(15000).then(() => null)]);
  result.scenarioB = {
    exitedOnItsOwn: Boolean(exitB),
    exitCode: exitB ? exitB.code : null,
    expectedNonZero: exitB ? exitB.code !== 0 : false,
    stderrTail: childB.getStderr().slice(-320).trim(),
  };

  result.ok =
    result.scenarioA.healthNoToken.status === 200 &&
    result.scenarioA.restNoToken.status === 401 &&
    result.scenarioA.restWrongToken.status === 401 &&
    result.scenarioA.restGoodToken.status === 200 &&
    result.scenarioA.mcpNoToken.status === 401 &&
    result.scenarioA.mcpWithToken.status === 200 &&
    result.scenarioB.exitedOnItsOwn &&
    result.scenarioB.exitCode !== 0;
} catch (e) {
  result = { ok: false, error: String((e && e.message) || e) };
} finally {
  if (child) stop(child);
  if (childB) stop(childB);
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
