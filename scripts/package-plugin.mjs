/**
 * 把构建好的思源插件打包成可分发的 zip。
 *
 * 思源集市要求 zip 的**根目录**下直接是 index.js / index.css / plugin.json /
 * i18n/ / icon.png 等，不能多一层 dist/ 目录。
 *
 * 实现说明：零依赖手工构造 ZIP（store 模式，不压缩）。
 * 之所以不用 shell 的 zip 命令或 Compress-Archive，是为了在 Windows / macOS / Linux
 * 上行为一致；也不为此引入 archiver 之类的重量级依赖（插件包本身很小，压缩收益有限）。
 *
 * 用法：
 *   node scripts/package-plugin.mjs                 # 构建 + 打包
 *   node scripts/package-plugin.mjs --no-build      # 只打包（要求 dist 已存在）
 *   node scripts/package-plugin.mjs --out=my.zip
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(root, 'siyuan-plugin');
const distDir = join(pluginDir, 'dist');

const argv = process.argv.slice(2);
const noBuild = argv.includes('--no-build');
const outArg = argv.find((a) => a.startsWith('--out='));
const outFile = resolve(pluginDir, outArg ? outArg.slice('--out='.length) : 'package.zip');

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 递归列出目录下所有文件的相对路径（zip 内统一用 / 分隔） */
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

/** 用 store 模式（不压缩）构造 zip */
function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const size = data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x21, 12); // mod date (1980-01-01 的合法值)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    centralParts.push(cd, nameBuf);

    offset += local.length + nameBuf.length + size;
  }

  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, eocd]);
}

// ---------- 主流程 ----------
if (!noBuild) {
  console.log('[package] 构建插件...');
  const build = spawnSync('npm', ['run', 'build'], { cwd: pluginDir, shell: true, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error(`[package] 构建失败，退出码 ${build.status}`);
    process.exit(build.status ?? 1);
  }
}

if (!existsSync(distDir)) {
  console.error(`[package] 找不到构建产物：${distDir}`);
  process.exit(1);
}

const manifestPath = join(distDir, 'plugin.json');
if (!existsSync(manifestPath)) {
  console.error('[package] dist 缺少 plugin.json，拒绝打包。');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// 打包前自检：plugin.json 里引用的 readme 必须真实存在，否则思源会拒绝加载
const missing = [];
for (const [lang, file] of Object.entries(manifest.readme || {})) {
  if (file && !existsSync(join(distDir, file))) missing.push(`readme.${lang} -> ${file}`);
}
if (missing.length > 0) {
  console.error('[package] plugin.json 引用了不存在的文件，思源会拒绝加载：');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

const names = listFiles(distDir).sort();
const entries = names.map((name) => ({ name, data: readFileSync(join(distDir, name)) }));
const zip = buildZip(entries);
writeFileSync(outFile, zip);

console.log(`[package] 插件名   : ${manifest.name}@${manifest.version}`);
console.log(`[package] 输出     : ${outFile}`);
console.log(`[package] 文件数   : ${entries.length}（未压缩 ${zip.length} 字节）`);
console.log('[package] 内容清单（zip 根目录，无多余层级）：');
for (const n of names) console.log(`  ${n}`);
