/**
 * MCP Daemon - 开机自启安装器 (installer)
 *
 * 用法：
 *   node dist/installer.js install   [--dry-run]
 *   node dist/installer.js uninstall [--dry-run]
 *
 * 平台实现：
 *   - win32 : 写入 HKCU\Software\Microsoft\Windows\CurrentVersion\Run（用户级，无需管理员权限）
 *   - darwin: 生成 ~/Library/LaunchAgents/com.siyuan.mcp-daemon.plist 并 launchctl load -w
 *   - linux : 生成 ~/.config/systemd/user/siyuan-mcp-daemon.service 并 systemctl --user enable --now
 *   - 其他  : 明确报错「当前平台未实现」并以退出码 1 结束（不静默失败）
 *
 * 幂等性：install 重复执行会覆盖同名项；uninstall 在未安装时同样返回退出码 0。
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Windows 注册表：当前用户的开机自启项（HKCU，无需管理员权限） */
const WINDOWS_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const WINDOWS_RUN_VALUE = 'SiYuanMCPDaemon';

/** macOS launchd 用户级 LaunchAgent */
const LAUNCHD_LABEL = 'com.siyuan.mcp-daemon';

/** Linux systemd 用户级 unit */
const SYSTEMD_UNIT = 'siyuan-mcp-daemon.service';

export interface InstallerPaths {
  /** daemon 工作目录：决定 pid/log 位置，以及 ../mcp-server 的解析结果 */
  workDir: string;
  /** node 可执行文件绝对路径 */
  nodePath: string;
  /** daemon 入口绝对路径（dist/index.js） */
  entryPath: string;
}

export interface RunResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * 解析安装所需路径。入口相对 install 产物自身定位，避免依赖调用者的 cwd。
 */
export function resolveInstallerPaths(): InstallerPaths {
  const installerPath = fileURLToPath(import.meta.url); // .../dist/installer.js
  const distDir = path.dirname(installerPath);

  return {
    workDir: path.dirname(distDir),
    nodePath: process.execPath,
    entryPath: path.join(distDir, 'index.js'),
  };
}

/**
 * 构造 Windows 开机自启命令行。
 *
 * 注册表 Run 项由 Explorer 启动，其工作目录不可控（通常是 system32 或用户目录），
 * 而 daemon 用 process.cwd() 解析 pidFile/logFile 与 ../mcp-server/dist/index.js，
 * 因此这里显式 `cd /d` 到项目目录再启动，保证自启后的行为与手动 `npm start` 一致。
 */
export function buildWindowsRunCommand(paths: InstallerPaths): string {
  return `cmd.exe /c cd /d "${paths.workDir}" && "${paths.nodePath}" "${paths.entryPath}"`;
}

/**
 * 构造 macOS launchd plist 内容。
 */
export function buildLaunchdPlist(paths: InstallerPaths): string {
  const logPath = path.join(paths.workDir, 'daemon.out.log');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(paths.nodePath)}</string>
    <string>${escapeXml(paths.entryPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(paths.workDir)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${escapeXml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(logPath)}</string>
</dict>
</plist>
`;
}

/**
 * 构造 Linux systemd 用户级 unit 内容。
 */
export function buildSystemdUnit(paths: InstallerPaths): string {
  return `[Unit]
Description=SiYuan MCP Daemon (manages the SiYuan MCP Server)
After=network.target

[Service]
Type=simple
WorkingDirectory="${paths.workDir}"
ExecStart="${paths.nodePath}" "${paths.entryPath}"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function info(message: string): void {
  console.log(`[installer] ${message}`);
}

function step(message: string): void {
  console.log(`  - ${message}`);
}

function fail(message: string): void {
  console.error(`[installer] 错误: ${message}`);
}

/**
 * 执行外部命令（spawnSync + 参数数组，不经过 shell，无需额外转义）。
 */
function run(command: string, args: string[]): RunResult {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || result.error?.message || '').trim(),
  };
}

/**
 * 仅用于终端展示的命令行文本；真正的执行走 spawnSync 参数数组，不依赖这里的引号。
 */
function formatCommand(command: string, args: string[]): string {
  const rendered = args.map((arg) => {
    if (!/[\s"]/.test(arg)) {
      return arg;
    }
    return `"${arg.replace(/"/g, '\\"')}"`;
  });

  return [command, ...rendered].join(' ');
}

// ---------------------------------------------------------------------------
// Windows (HKCU\...\Run)
// ---------------------------------------------------------------------------

function queryWindowsRunValue(): string | null {
  const result = run('reg', ['query', WINDOWS_RUN_KEY, '/v', WINDOWS_RUN_VALUE]);
  if (!result.ok) {
    return null;
  }

  // 输出形如：    SiYuanMCPDaemon    REG_SZ    cmd.exe /c cd /d "..."
  const line = result.stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(WINDOWS_RUN_VALUE));

  if (!line) {
    return null;
  }

  return line.slice(WINDOWS_RUN_VALUE.length).trim().replace(/^REG_SZ\s*/i, '').trim();
}

function installWindows(paths: InstallerPaths, dryRun: boolean): number {
  const command = buildWindowsRunCommand(paths);
  const args = ['add', WINDOWS_RUN_KEY, '/v', WINDOWS_RUN_VALUE, '/t', 'REG_SZ', '/d', command, '/f'];

  info('平台 win32：使用 HKCU 注册表 Run 项（用户级开机自启，无需管理员权限）');
  info(`注册表位置: ${WINDOWS_RUN_KEY}`);
  info(`值名: ${WINDOWS_RUN_VALUE}`);
  info(`值类型: REG_SZ`);
  info(`值数据: ${command}`);

  const existing = queryWindowsRunValue();
  if (existing === null) {
    step('当前未安装，将新建自启项');
  } else if (existing === command) {
    step('已存在完全相同的自启项，install 仍会覆盖写入（幂等）');
  } else {
    step('已存在同名自启项，install 将覆盖它（幂等）');
    step(`原有值数据: ${existing}`);
  }

  if (dryRun) {
    step(`[dry-run] 将执行: ${formatCommand('reg', args)}`);
    step('[dry-run] 未写入注册表，系统状态保持不变');
    return 0;
  }

  step(`执行: ${formatCommand('reg', args)}`);
  const result = run('reg', args);
  if (!result.ok) {
    fail(`写入注册表失败 (exit=${result.status}): ${result.stderr || result.stdout}`);
    return 1;
  }

  const written = queryWindowsRunValue();
  if (written !== command) {
    fail(`写入后回读校验不通过，当前值: ${written ?? '(空)'}`);
    return 1;
  }

  info('安装完成，已回读校验通过。下次登录时 daemon 将自动启动。');
  return 0;
}

function uninstallWindows(dryRun: boolean): number {
  const args = ['delete', WINDOWS_RUN_KEY, '/v', WINDOWS_RUN_VALUE, '/f'];

  info('平台 win32：移除 HKCU 注册表 Run 项');
  info(`注册表位置: ${WINDOWS_RUN_KEY}`);
  info(`值名: ${WINDOWS_RUN_VALUE}`);

  const existing = queryWindowsRunValue();
  if (existing === null) {
    info('未安装自启项，无需卸载（幂等，退出码 0）');
    return 0;
  }

  step(`当前值数据: ${existing}`);

  if (dryRun) {
    step(`[dry-run] 将执行: ${formatCommand('reg', args)}`);
    step('[dry-run] 未修改注册表，系统状态保持不变');
    return 0;
  }

  step(`执行: ${formatCommand('reg', args)}`);
  const result = run('reg', args);
  if (!result.ok) {
    fail(`删除注册表项失败 (exit=${result.status}): ${result.stderr || result.stdout}`);
    return 1;
  }

  const after = queryWindowsRunValue();
  if (after !== null) {
    fail(`删除后回读校验不通过，仍存在值: ${after}`);
    return 1;
  }

  info('卸载完成，已回读校验确认自启项已删除。');
  return 0;
}

// ---------------------------------------------------------------------------
// macOS (launchd LaunchAgent)
// ---------------------------------------------------------------------------

function launchAgentPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`);
}

function installDarwin(paths: InstallerPaths, dryRun: boolean): number {
  const target = launchAgentPath();
  const content = buildLaunchdPlist(paths);

  info('平台 darwin：使用用户级 LaunchAgent（无需 sudo）');
  info(`plist 路径: ${target}`);
  info('将写入以下内容:');
  console.log(content);

  if (dryRun) {
    step(`[dry-run] 将执行: launchctl unload -w "${target}"（此前未加载会失败，忽略以保证幂等）`);
    step(`[dry-run] 将执行: ${formatCommand('launchctl', ['load', '-w', target])}`);
    step('[dry-run] 未写入文件，也未调用 launchctl，系统状态保持不变');
    return 0;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(target)) {
    const unload = run('launchctl', ['unload', '-w', target]);
    step(
      unload.ok
        ? '已卸载此前的 LaunchAgent'
        : 'launchctl unload 返回非 0（通常表示此前未加载），忽略'
    );
  }

  fs.writeFileSync(target, content, 'utf8');
  step(`已写入 ${target}`);

  const load = run('launchctl', ['load', '-w', target]);
  if (!load.ok) {
    fail(`launchctl load 失败 (exit=${load.status}): ${load.stderr || load.stdout}`);
    return 1;
  }

  info('安装完成，LaunchAgent 已加载。');
  return 0;
}

function uninstallDarwin(dryRun: boolean): number {
  const target = launchAgentPath();

  info('平台 darwin：移除用户级 LaunchAgent');
  info(`plist 路径: ${target}`);

  if (!fs.existsSync(target)) {
    info('未安装 LaunchAgent，无需卸载（幂等，退出码 0）');
    return 0;
  }

  if (dryRun) {
    step(`[dry-run] 将执行: launchctl unload -w "${target}"`);
    step(`[dry-run] 将删除文件: ${target}`);
    step('[dry-run] 未做任何修改，系统状态保持不变');
    return 0;
  }

  const unload = run('launchctl', ['unload', '-w', target]);
  step(
    unload.ok
      ? '已卸载 LaunchAgent'
      : 'launchctl unload 返回非 0（通常表示此前未加载），继续删除文件'
  );

  fs.unlinkSync(target);
  if (fs.existsSync(target)) {
    fail(`删除后校验不通过，文件仍存在: ${target}`);
    return 1;
  }

  info('卸载完成，已确认 plist 文件已删除。');
  return 0;
}

// ---------------------------------------------------------------------------
// Linux (systemd user unit)
// ---------------------------------------------------------------------------

function systemdUnitPath(): string {
  return path.join(os.homedir(), '.config', 'systemd', 'user', SYSTEMD_UNIT);
}

function installLinux(paths: InstallerPaths, dryRun: boolean): number {
  const target = systemdUnitPath();
  const content = buildSystemdUnit(paths);

  info('平台 linux：使用 systemd 用户级 unit（systemctl --user，无需 sudo）');
  info(`unit 路径: ${target}`);
  info('将写入以下内容:');
  console.log(content);

  const reloadArgs = ['--user', 'daemon-reload'];
  const enableArgs = ['--user', 'enable', '--now', SYSTEMD_UNIT];

  if (dryRun) {
    step(`[dry-run] 将执行: ${formatCommand('systemctl', reloadArgs)}`);
    step(`[dry-run] 将执行: ${formatCommand('systemctl', enableArgs)}`);
    step('[dry-run] 未写入文件，也未调用 systemctl，系统状态保持不变');
    return 0;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  step(`已写入 ${target}`);

  const reload = run('systemctl', reloadArgs);
  if (!reload.ok) {
    fail(`systemctl daemon-reload 失败 (exit=${reload.status}): ${reload.stderr || reload.stdout}`);
    return 1;
  }
  step('已执行 systemctl --user daemon-reload');

  const enable = run('systemctl', enableArgs);
  if (!enable.ok) {
    fail(`systemctl enable --now 失败 (exit=${enable.status}): ${enable.stderr || enable.stdout}`);
    return 1;
  }
  step('已执行 systemctl --user enable --now');

  info('安装完成，systemd 用户服务已启用并启动。');
  return 0;
}

function uninstallLinux(dryRun: boolean): number {
  const target = systemdUnitPath();

  info('平台 linux：移除 systemd 用户级 unit');
  info(`unit 路径: ${target}`);

  if (!fs.existsSync(target)) {
    info('未安装 systemd 用户服务，无需卸载（幂等，退出码 0）');
    return 0;
  }

  const disableArgs = ['--user', 'disable', '--now', SYSTEMD_UNIT];
  const reloadArgs = ['--user', 'daemon-reload'];

  if (dryRun) {
    step(`[dry-run] 将执行: ${formatCommand('systemctl', disableArgs)}`);
    step(`[dry-run] 将删除文件: ${target}`);
    step(`[dry-run] 将执行: ${formatCommand('systemctl', reloadArgs)}`);
    step('[dry-run] 未做任何修改，系统状态保持不变');
    return 0;
  }

  const disable = run('systemctl', disableArgs);
  step(
    disable.ok
      ? '已停用并停止 systemd 用户服务'
      : 'systemctl disable 返回非 0（通常表示此前未启用），继续删除 unit 文件'
  );

  fs.unlinkSync(target);
  if (fs.existsSync(target)) {
    fail(`删除后校验不通过，文件仍存在: ${target}`);
    return 1;
  }

  run('systemctl', reloadArgs);
  info('卸载完成，已确认 unit 文件已删除。');
  return 0;
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

const USAGE = `用法: node dist/installer.js <install|uninstall> [--dry-run]

  参数:
    install      注册开机自启
    uninstall    移除开机自启
    --dry-run    只打印将要执行的操作，不写入任何内容

  平台支持:
    win32    HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run（用户级，无需管理员）
    darwin   ~/Library/LaunchAgents/${LAUNCHD_LABEL}.plist + launchctl
    linux    ~/.config/systemd/user/${SYSTEMD_UNIT} + systemctl --user
    其他平台  明确报错「当前平台未实现」并以退出码 1 结束
`;

/**
 * 安装器主流程，返回进程退出码。
 */
export function runInstaller(argv: string[]): number {
  const dryRun = argv.includes('--dry-run');
  const command = argv.find((item) => !item.startsWith('--'));

  if (command !== 'install' && command !== 'uninstall') {
    console.error(USAGE);
    fail(command ? `未知子命令: ${command}` : '缺少子命令');
    return 1;
  }

  const paths = resolveInstallerPaths();

  info(`命令: ${command}${dryRun ? ' (--dry-run)' : ''}`);
  info(`平台: ${process.platform}`);
  info(`工作目录: ${paths.workDir}`);
  info(`node 可执行文件: ${paths.nodePath}`);
  info(`daemon 入口: ${paths.entryPath}`);

  if (!fs.existsSync(paths.entryPath)) {
    const message = `找不到 daemon 入口文件 ${paths.entryPath}，请先执行 npm run build`;
    if (dryRun) {
      info(`警告: ${message}（dry-run 继续，不会写入任何内容）`);
    } else {
      fail(message);
      return 1;
    }
  }

  switch (process.platform) {
    case 'win32':
      return command === 'install' ? installWindows(paths, dryRun) : uninstallWindows(dryRun);
    case 'darwin':
      return command === 'install' ? installDarwin(paths, dryRun) : uninstallDarwin(dryRun);
    case 'linux':
      return command === 'install' ? installLinux(paths, dryRun) : uninstallLinux(dryRun);
    default:
      fail(`当前平台未实现 (process.platform = "${process.platform}")`);
      console.error(`[installer] 已支持的平台: win32 / darwin / linux。本次未做任何修改。`);
      return 1;
  }
}

// 跨平台判断「是否作为主程序直接运行」，与 src/index.ts 保持一致
const isMainModule =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  process.exit(runInstaller(process.argv.slice(2)));
}
