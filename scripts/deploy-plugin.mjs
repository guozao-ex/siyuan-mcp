/**
 * 把构建好的思源插件部署到思源工作空间的 data/plugins 目录。
 *
 * 为什么需要这个脚本：
 * 思源内核不接受 junction / 符号链接形式的插件目录
 * （实测：junction 指向 dist 时 /api/petal/setPetalEnabled 报 "plugin not found"），
 * 因此开发时必须把 dist 的真实文件复制进去。
 *
 * 用法：
 *   node scripts/deploy-plugin.mjs --workspace="C:\Program Files\SiYuan zone"
 *   SIYUAN_WORKSPACE="..." node scripts/deploy-plugin.mjs
 *   node scripts/deploy-plugin.mjs --workspace="..." --build   # 先构建再部署
 *   node scripts/deploy-plugin.mjs --workspace="..." --dry-run
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(root, 'siyuan-plugin');
const distDir = join(pluginDir, 'dist');

const argv = process.argv.slice(2);
const getArg = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const workspace = getArg('workspace') || process.env.SIYUAN_WORKSPACE;
const dryRun = hasFlag('dry-run');

if (!workspace) {
  console.error('错误：未指定思源工作空间。');
  console.error('请用 --workspace="<路径>" 或环境变量 SIYUAN_WORKSPACE 指定，例如：');
  console.error('  node scripts/deploy-plugin.mjs --workspace="C:\\Users\\me\\SiYuan"');
  console.error('工作空间路径可在思源「设置 → 关于」中查看。');
  process.exit(2);
}

// 1. 可选：先构建
if (hasFlag('build')) {
  console.log('[deploy] 构建插件...');
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: pluginDir,
    shell: true,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    console.error(`[deploy] 构建失败，退出码 ${build.status}`);
    process.exit(build.status ?? 1);
  }
}

// 2. 校验产物
if (!existsSync(distDir)) {
  console.error(`[deploy] 找不到构建产物：${distDir}`);
  console.error('[deploy] 请先执行 cd siyuan-plugin && npm run build，或加 --build 参数。');
  process.exit(1);
}

const manifestPath = join(distDir, 'plugin.json');
if (!existsSync(manifestPath)) {
  console.error(`[deploy] dist 中缺少 plugin.json，构建产物不完整。`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pluginName = manifest.name;
if (!pluginName) {
  console.error('[deploy] plugin.json 缺少 name 字段。');
  process.exit(1);
}

// 3. 目标目录
const pluginsRoot = join(workspace, 'data', 'plugins');
if (!existsSync(pluginsRoot)) {
  console.error(`[deploy] 目标不是有效的思源工作空间：缺少 ${pluginsRoot}`);
  process.exit(1);
}
const target = join(pluginsRoot, pluginName);

// 4. 部署前自检：plugin.json 里引用的资源必须真实存在，否则思源会拒绝加载
const missing = [];
for (const [lang, file] of Object.entries(manifest.readme || {})) {
  if (file && !existsSync(join(distDir, file))) missing.push(`readme.${lang} -> ${file}`);
}
if (missing.length > 0) {
  console.error('[deploy] plugin.json 引用了不存在的文件，思源会拒绝加载该插件：');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(`[deploy] 插件名   : ${pluginName}`);
console.log(`[deploy] 源目录   : ${distDir}`);
console.log(`[deploy] 目标目录 : ${target}`);

if (dryRun) {
  console.log('[deploy] --dry-run，仅列出将要复制的文件：');
  for (const f of listFiles(distDir)) console.log(`  ${f}`);
  process.exit(0);
}

// 5. 复制（先清空目标目录，避免残留旧文件）
if (existsSync(target)) {
  const st = statSync(target);
  if (st.isSymbolicLink()) {
    // 符号链接/junction：直接删链接
    rmSync(target, { force: true });
  } else {
    for (const entry of readdirSync(target)) {
      rmSync(join(target, entry), { recursive: true, force: true });
    }
  }
}
mkdirSync(target, { recursive: true });
let count = 0;
for (const rel of listFiles(distDir)) {
  const from = join(distDir, rel);
  const to = join(target, rel);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  count += 1;
}
console.log(`[deploy] 已复制 ${count} 个文件。`);
console.log('[deploy] 完成。请在思源中重启应用，或在「集市 → 已下载」中重载该插件。');

/** 递归列出 dist 下所有文件的相对路径 */
function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}
