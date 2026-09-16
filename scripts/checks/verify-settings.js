/**
 * 验证设置面板的持久化闭环（P2-1）。
 *
 * 流程：打开面板 -> 改写 MCP 服务器地址 -> 保存 -> 关闭 -> 重新打开 -> 校验显示的是新值
 *       -> 再改回原值并保存（还原现场）
 *
 * 这里直接调用插件实例上的方法（TypeScript 的 private 只是编译期约束，运行时可访问）。
 *
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/verify-settings.js
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.siyuan.ws.app;
  const plugin = app.plugins.find((p) => p.name === 'siyuan-plugin-mcp');
  if (!plugin) return JSON.stringify({ error: 'plugin not loaded' }, null, 2);

  const out = {};
  const original = plugin.settings.mcpServerUrl;
  const probeValue = 'http://127.0.0.1:3099';

  /** 让 Svelte 的 bind:value 认到新值：必须走原生 setter + input 事件 */
  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function openSettings() {
    plugin.openSettings();
  }

  function closeSettings() {
    const btn = document.querySelector('.settings-panel__close');
    if (btn) btn.click();
  }

  // ---- 第 1 次打开：记录初始显示值 ----
  openSettings();
  await sleep(200);
  out.firstOpen = {
    panelPresent: Boolean(document.querySelector('.settings-panel')),
    urlShown: (document.querySelector('#mcpServerUrl') || {}).value ?? null,
    pluginUrl: original,
  };

  // ---- 改动 + 保存 ----
  const urlInput = document.querySelector('#mcpServerUrl');
  if (!urlInput) {
    out.error = 'settings input not found';
    return JSON.stringify(out, null, 2);
  }
  setInputValue(urlInput, probeValue);
  await sleep(120);

  const saveBtn = Array.from(document.querySelectorAll('.settings-panel__button')).find((b) =>
    (b.textContent || '').includes('保存')
  );
  out.saveButtonFound = Boolean(saveBtn);
  out.saveButtonEnabled = saveBtn ? !saveBtn.disabled : null;
  if (saveBtn) saveBtn.click();
  await sleep(900); // 保存会触发 initMcpClient（含一次连接尝试）

  out.afterSave = {
    pluginUrlInMemory: plugin.settings.mcpServerUrl,
    expected: probeValue,
  };

  // ---- 重新打开：应当显示刚保存的值 ----
  openSettings();
  await sleep(250);
  out.reopen = {
    urlShown: (document.querySelector('#mcpServerUrl') || {}).value ?? null,
    expected: probeValue,
    persistedCorrectly: ((document.querySelector('#mcpServerUrl') || {}).value ?? null) === probeValue,
  };

  // ---- 还原现场：改回原值并保存 ----
  const input2 = document.querySelector('#mcpServerUrl');
  if (input2) {
    setInputValue(input2, original);
    await sleep(120);
    const saveBtn2 = Array.from(document.querySelectorAll('.settings-panel__button')).find((b) =>
      (b.textContent || '').includes('保存')
    );
    if (saveBtn2) saveBtn2.click();
    await sleep(900);
  }
  out.restored = {
    pluginUrlInMemory: plugin.settings.mcpServerUrl,
    expected: original,
    ok: plugin.settings.mcpServerUrl === original,
  };

  closeSettings();
  await sleep(150);
  out.panelClosed = !document.querySelector('.settings-panel');

  // 校验 i18n 的 settings 键仍是字符串（P0-4 的回归检查）
  out.i18nSettingsType = typeof plugin.i18n.settings;

  out.ok =
    out.firstOpen.panelPresent &&
    out.reopen.persistedCorrectly &&
    out.restored.ok &&
    out.i18nSettingsType === 'string';

  return JSON.stringify(out, null, 2);
})();
