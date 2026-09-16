/**
 * Tests for the minimal .env loader
 *
 * 这个模块此前不存在，导致用户按文档配置 .env 却不生效。
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseEnvFile, loadEnvFile } from '../src/core/env-file';

describe('parseEnvFile', () => {
  it('parses simple KEY=VALUE pairs', () => {
    expect(parseEnvFile('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('skips comments and blank lines', () => {
    expect(parseEnvFile('# a comment\n\n   \nFOO=1')).toEqual({ FOO: '1' });
  });

  it('strips surrounding double and single quotes', () => {
    expect(parseEnvFile('A="x y"\nB=\'z\'')).toEqual({ A: 'x y', B: 'z' });
  });

  it('strips trailing comments from unquoted values', () => {
    expect(parseEnvFile('A=value # trailing note')).toEqual({ A: 'value' });
  });

  it('keeps a # that is inside quotes', () => {
    expect(parseEnvFile('A="a # b"')).toEqual({ A: 'a # b' });
  });

  it('supports the export prefix', () => {
    expect(parseEnvFile('export A=1')).toEqual({ A: '1' });
  });

  it('ignores malformed lines', () => {
    expect(parseEnvFile('NOEQUALS\n=novalue\n1BAD=x\n')).toEqual({});
  });

  it('handles CRLF line endings', () => {
    expect(parseEnvFile('A=1\r\nB=2\r\n')).toEqual({ A: '1', B: '2' });
  });

  it('allows empty values', () => {
    expect(parseEnvFile('A=\nB=2')).toEqual({ A: '', B: '2' });
  });

  it('parses a realistic block', () => {
    const content = [
      '# SiYuan',
      'SIYUAN_API_URL=http://127.0.0.1:6806',
      'SIYUAN_API_TOKEN=',
      '',
      '# Auth',
      'MCP_AUTH_TOKEN="abc123"',
      'LLM_MODEL=deepseek-chat # 默认模型',
    ].join('\n');

    expect(parseEnvFile(content)).toEqual({
      SIYUAN_API_URL: 'http://127.0.0.1:6806',
      SIYUAN_API_TOKEN: '',
      MCP_AUTH_TOKEN: 'abc123',
      LLM_MODEL: 'deepseek-chat',
    });
  });
});

describe('loadEnvFile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-env-file-'));
  const MANAGED_KEYS = ['DSH_ENV_TEST_A', 'DSH_ENV_TEST_B'];

  function writeEnv(name: string, content: string): string {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content, 'utf8');
    return p;
  }

  afterEach(() => {
    for (const key of MANAGED_KEYS) delete process.env[key];
  });

  it('returns 0 when the file does not exist', () => {
    expect(loadEnvFile(path.join(tmpDir, 'definitely-missing.env'))).toBe(0);
  });

  it('writes keys that are not yet in process.env', () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    const p = writeEnv('basic.env', 'DSH_ENV_TEST_A=hello\nDSH_ENV_TEST_B=world\n');

    expect(loadEnvFile(p)).toBe(2);
    expect(process.env.DSH_ENV_TEST_A).toBe('hello');
    expect(process.env.DSH_ENV_TEST_B).toBe('world');
  });

  it('does NOT override values already present in process.env', () => {
    process.env.DSH_ENV_TEST_A = 'from-real-env';
    delete process.env.DSH_ENV_TEST_B;
    const p = writeEnv('override.env', 'DSH_ENV_TEST_A=from-file\nDSH_ENV_TEST_B=from-file\n');

    // 只应写入 B，A 因已存在而被跳过
    expect(loadEnvFile(p)).toBe(1);
    expect(process.env.DSH_ENV_TEST_A).toBe('from-real-env');
    expect(process.env.DSH_ENV_TEST_B).toBe('from-file');
  });

  it('does not choke on unreadable content (empty file)', () => {
    const p = writeEnv('empty.env', '');
    expect(loadEnvFile(p)).toBe(0);
  });
});
