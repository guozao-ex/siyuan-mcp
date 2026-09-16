/**
 * 极简 .env 加载器（零依赖）。
 *
 * 为什么需要它：
 * 项目文档与 .env.example 都引导用户通过 `.env` 配置（MCP_AUTH_TOKEN、LLM_API_KEY 等），
 * 但代码只读 `process.env`，此前 `.env` 根本不会被加载 —— 用户照文档配好却不生效。
 *
 * 行为约定：
 *   - **真实环境变量优先**：已存在于 process.env 的键不会被 .env 覆盖。
 *     这样 CI / 容器的环境变量注入仍然有效。
 *   - 支持 `#` 注释、空行、`KEY=VALUE`，值两端的成对引号会被去掉。
 *   - 找不到文件时静默跳过（.env 是可选的）。
 *   - 可用 DOTENV_PATH 指定其它路径。
 *
 * ⚠️ 本模块是**副作用模块**：在被 import 的那一刻就执行加载。
 * 因此它必须是入口文件的第一条 import —— 否则 enhanced-logger 等模块会在
 * 模块求值阶段先把 process.env 读走（例如 LOG_LEVEL），导致 .env 失效。
 * ESM 按声明顺序求值 import，故顺序在这里是有语义的。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 解析 .env 的默认位置：本文件位于 <project>/src/utils 或 <project>/dist/utils，向上两级即项目根 */
function defaultEnvPath(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.join(path.resolve(here, '..', '..'), '.env');
  } catch {
    return path.join(process.cwd(), '.env');
  }
}

/**
 * 解析 .env 文本为键值对。
 * 抽成独立函数是为了可以在不触碰 process.env 的前提下做单元测试。
 */
export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};

  // 去掉 UTF-8 BOM：Windows 记事本 / PowerShell 5 的 `Set-Content -Encoding UTF8`
  // 都会写入 BOM，不处理的话第一行的键名会变成 "\uFEFFKEY"，整行静默失效
  // （典型症状：.env 里明明写了 MCP_TRANSPORT=http，服务却仍以 stdio 模式启动）。
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // 允许 `export KEY=VALUE` 这种写法
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;

    const eq = normalized.indexOf('=');
    if (eq <= 0) continue;

    const key = normalized.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = normalized.slice(eq + 1).trim();

    // 去掉成对的包裹引号
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // 未加引号时，` #` 之后视为行尾注释
      const hashIdx = value.indexOf(' #');
      if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();
    }

    out[key] = value;
  }

  return out;
}

/**
 * 加载 .env 到 process.env（不覆盖已存在的键）。
 * @returns 实际写入的键数量；文件不存在时返回 0。
 */
export function loadEnvFile(filePath: string = defaultEnvPath()): number {
  let content: string;
  try {
    if (!fs.existsSync(filePath)) return 0;
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return 0;
  }

  const parsed = parseEnvFile(content);
  let applied = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied += 1;
    }
  }
  return applied;
}

// ---- 模块副作用：立即加载 ----
export const ENV_FILE_PATH = process.env.DOTENV_PATH || defaultEnvPath();
export const ENV_FILE_APPLIED = loadEnvFile(ENV_FILE_PATH);
