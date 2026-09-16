/**
 * 通过 Chrome DevTools Protocol 在思源渲染进程里执行一段 JavaScript。
 *
 * 用途：对思源插件做真实的端到端验证（例如确认插件是否加载、顶栏图标是否存在）。
 * 前置：思源需要以 --remote-debugging-port=9222 启动。
 *
 * 用法：
 *   node scripts/cdp-eval.mjs "JSON.stringify(Object.keys(window.siyuan || {}))"
 *   node scripts/cdp-eval.mjs --target=all "document.title"
 */
const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';

const argv = process.argv.slice(2);
let targetFilter = 'page';
let file = null;
const positional = [];
for (const arg of argv) {
  if (arg.startsWith('--target=')) targetFilter = arg.slice('--target='.length);
  else if (arg.startsWith('--file=')) file = arg.slice('--file='.length);
  else positional.push(arg);
}

// 表达式来源：--file 指定的文件，或命令行位置参数。
// 注意：Windows 的 PowerShell 会在传参时吃掉表达式里的双引号，
// 因此稍微复杂的表达式一律建议写进文件再用 --file 传入。
let expression;
if (file) {
  const { readFileSync } = await import('node:fs');
  expression = readFileSync(file, 'utf8');
} else {
  expression = positional.join(' ');
}

if (!expression || !expression.trim()) {
  console.error('usage: node scripts/cdp-eval.mjs "<javascript expression>"');
  console.error('       node scripts/cdp-eval.mjs --file=path/to/expression.js');
  process.exit(2);
}

const targets = await (await fetch(`${endpoint}/json`)).json();
const candidates = targets.filter((t) => t.type === targetFilter && t.webSocketDebuggerUrl);
if (candidates.length === 0) {
  console.error(`no CDP target of type "${targetFilter}" found. available:`);
  for (const t of targets) console.error(`  type=${t.type} title=${JSON.stringify(t.title)} url=${t.url}`);
  process.exit(3);
}

// 优先选择思源的编辑器页面，否则取第一个
const page =
  candidates.find((t) => /index\.html/.test(t.url)) ||
  candidates.find((t) => /siyuan/i.test(t.url)) ||
  candidates[0];

console.log(`# target: ${page.title}  (${page.url})`);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', (e) => reject(new Error(`websocket error: ${e.message || 'unknown'}`)), {
    once: true,
  });
});

let nextId = 1;
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method} failed: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await send('Runtime.enable');
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    console.error('# exception:');
    console.error(JSON.stringify(result.exceptionDetails, null, 2));
    process.exitCode = 1;
  } else {
    const value = result.result?.value;
    if (typeof value === 'string') console.log(value);
    else console.log(JSON.stringify(value, null, 2));
  }
} finally {
  ws.close();
}
