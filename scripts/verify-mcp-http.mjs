/**
 * 用 MCP SDK 的官方客户端验证标准 Streamable HTTP 端点（POST /mcp）。
 *
 * 验证点：
 *   1. 标准 MCP 客户端能完成 initialize 握手（会分配 session id）
 *   2. listTools 返回的工具集与 stdio 模式一致（12 个）
 *   3. callTool 能真实打通到思源
 *   4. 自定义 REST 端点（GET /tools）仍然可用（双轨互不影响）
 *
 * 进程安全：只操作自己 spawn 的子进程句柄。
 *
 * 用法：node scripts/verify-mcp-http.mjs
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const PORT = Number(process.env.VERIFY_MCP_PORT || 3011);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SDK 装在 mcp-server 下，脚本在仓库根目录，因此用绝对路径动态导入
const sdkEsm = resolve(serverDir, 'node_modules/@modelcontextprotocol/sdk/dist/esm');
const { Client } = await import(pathToFileURL(resolve(sdkEsm, 'client/index.js')).href);
const { StreamableHTTPClientTransport } = await import(
  pathToFileURL(resolve(sdkEsm, 'client/streamableHttp.js')).href
);

const EXPECTED_TOOLS = 72;

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
child.stdout.resume();

const exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));

let result;
let client;
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

  // ---- 1. 标准 MCP 客户端连接 /mcp ----
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`));
  client = new Client({ name: 'verify-mcp-http', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  const sessionId = transport.sessionId || null;

  // ---- 2. listTools ----
  const toolsResult = await client.listTools();
  const names = (toolsResult.tools || []).map((t) => t.name);

  // ---- 3. callTool（真实打到思源） ----
  const callResult = await client.callTool({ name: 'list_notebooks', arguments: {} });
  const firstText = (callResult.content && callResult.content[0] && callResult.content[0].text) || '';

  // ---- 4. 自定义 REST 仍然可用 ----
  const restRes = await fetch(`${BASE}/tools`);
  const restBody = await restRes.json();

  result = {
    ok:
      Boolean(sessionId) &&
      names.length === EXPECTED_TOOLS &&
      !callResult.isError &&
      restBody.tools.length === EXPECTED_TOOLS,
    standardMcp: {
      sessionIdAssigned: Boolean(sessionId),
      sessionIdPreview: sessionId ? `${sessionId.slice(0, 8)}…` : null,
      toolCount: names.length,
      toolNames: names,
      callToolSucceeded: !callResult.isError,
      callToolPreview: firstText.slice(0, 200).replace(/\s+/g, ' '),
    },
    legacyRest: {
      status: restRes.status,
      toolCount: restBody.tools.length,
    },
  };
} catch (e) {
  result = {
    ok: false,
    error: String((e && e.message) || e),
    stderrTail: stderr.slice(-900),
  };
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

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
