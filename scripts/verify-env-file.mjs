/**
 * 验证 .env 会被真正加载。
 *
 * 做法：把关键配置写进一个临时 .env（**不带 BOM**），通过 DOTENV_PATH 指给服务器，
 * 然后从**外部可观察的行为**反推它生效了 —— 而不是只看日志：
 *   1. 服务器监听的端口来自 .env（而不是默认 3000）
 *   2. .env 里的 MCP_AUTH_TOKEN 真的生效：不带 token 的请求被拒（401），带了才通（200）
 *
 * 这种"用行为证明配置生效"的验证，比读启动横幅更可靠。
 *
 * 进程安全：只操作自己 spawn 的子进程句柄，不做任何系统级进程查找。
 *
 * 用法：node scripts/verify-env-file.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, 'mcp-server');
const PORT = Number(process.env.VERIFY_ENV_PORT || 3026);
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'dotenv-proof-token';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const envPath = join(tmpdir(), `dsh-env-verify-${Date.now()}.env`);
// 刻意不加 BOM：主路径验证。BOM 兼容性由 tests/env-file.test.ts 覆盖。
const envContent = [
  '# 由 scripts/verify-env-file.mjs 生成的临时配置',
  'MCP_TRANSPORT=http',
  `MCP_PORT=${PORT}`,
  'MCP_HOST=127.0.0.1',
  'SIYUAN_API_URL=http://127.0.0.1:6806',
  `MCP_AUTH_TOKEN=${TOKEN}`,
  '',
].join('\n');
writeFileSync(envPath, envContent, 'utf8');

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  // 注意：这里不设 MCP_TRANSPORT / MCP_PORT / MCP_AUTH_TOKEN ——
  // 它们必须全部来自 .env，才能证明 .env 真的被加载。
  env: { ...process.env, DOTENV_PATH: envPath },
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
try {
  const deadline = Date.now() + 25000;
  let ready = false;
  while (Date.now() < deadline) {
    const gone = await Promise.race([exited, sleep(300).then(() => null)]);
    if (gone) throw new Error(`服务器提前退出 ${JSON.stringify(gone)}\n${stderr.slice(-600)}`);
    try {
      // /health 免认证，用它探活；端口本身来自 .env
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* 还没起来 */
    }
  }
  if (!ready) {
    throw new Error(
      `服务器未在 ${PORT} 就绪 —— 若它退回 stdio 模式或监听 3000，就说明 .env 没被加载。stderr:\n${stderr.slice(-700)}`
    );
  }

  // 用行为验证 MCP_AUTH_TOKEN 生效
  const noToken = await fetch(`${BASE}/tools`, { method: 'GET' });
  const withToken = await fetch(`${BASE}/tools`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const banner = stderr
    .split(/\r?\n/)
    .filter((l) => /Transport Mode|HTTP Server|Auth Token/.test(l))
    .map((l) => l.trim());

  result = {
    ok:
      noToken.status === 401 &&
      withToken.status === 200 &&
      banner.some((l) => /Transport Mode: http/.test(l)) &&
      banner.some((l) => /Auth Token: set/.test(l)),
    assertions: {
      // 端口来自 .env（否则根本连不上）
      portFromDotenv: true,
      transportModeFromDotenv: banner.some((l) => /Transport Mode: http/.test(l)),
      authTokenFromDotenvRejectsWithoutToken: noToken.status === 401,
      authTokenFromDotenvAcceptsWithToken: withToken.status === 200,
    },
    configBannerFromStderr: banner,
    httpStatus: { withoutToken: noToken.status, withToken: withToken.status },
  };
} catch (e) {
  result = { ok: false, error: String((e && e.message) || e), stderrTail: stderr.slice(-900) };
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await sleep(400);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  if (existsSync(envPath)) {
    try {
      unlinkSync(envPath);
    } catch {
      /* ignore */
    }
  }
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
