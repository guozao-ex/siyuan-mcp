/**
 * 验证插件在移除「内置 AI 能力」后的最终形态。
 *
 * 现在插件的职责只有两件事：
 *   1. 提供 MCP 服务器的配置入口（顶栏图标 / 命令）
 *   2. 告诉用户去哪儿用 AI（外部 Agent）
 *
 * 因此本脚本断言的是「**不该有的东西确实没有了**」：
 *   - 不再往块菜单注入 AI 操作
 *   - 不再持有模型客户端
 *   - 顶栏图标打开的是设置面板
 *
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/verify-plugin-caps.js
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.siyuan.ws.app;
  const plugin = app.plugins.find((p) => p.name === 'siyuan-plugin-mcp');
  if (!plugin) return JSON.stringify({ error: 'plugin not loaded' }, null, 2);

  const out = {
    i18nOpenPluginSettings: plugin.i18n.openPluginSettings,
    i18nKeyCount: plugin.i18n ? Object.keys(plugin.i18n).length : 0,
    // 模型层已移除，这些字段不应再存在
    noLlmClientField: plugin.llmClient === undefined,
    noPanelComponentField: plugin.aiPanelComponent === undefined,
    noPendingBlockTasks: plugin.pendingBlockTasks === undefined,
  };

  // ---- 块菜单应保持"零注入"（AI 操作已随模型层一起移除）----
  const fakeBlock = document.createElement('div');
  fakeBlock.setAttribute('data-node-id', '20240101120000-fakeid');
  const captured = { separators: 0, items: [] };
  const fakeMenu = {
    addSeparator() {
      captured.separators += 1;
    },
    addItem(item) {
      captured.items.push(item.label);
    },
  };
  plugin.eventBus.emit('click-blockicon', {
    menu: fakeMenu,
    protyle: null,
    blockElements: [fakeBlock],
  });
  out.blockMenu = { separators: captured.separators, items: captured.items };

  // ---- 顶栏图标应打开设置面板 ----
  const label = plugin.i18n.openPluginSettings;
  const topBar = document.querySelector(`.toolbar__item[aria-label="${label}"]`);
  out.topBarFound = Boolean(topBar);
  if (topBar) {
    topBar.click();
    await sleep(300);
    out.afterTopBarClick = {
      settingsPanelShown: Boolean(document.querySelector('.settings-panel')),
      aiPanelAbsent: document.querySelectorAll('.ai-panel').length === 0,
    };
    const close = document.querySelector('.settings-panel__close');
    if (close) close.click();
    await sleep(200);
  }

  out.ok =
    out.blockMenu.items.length === 0 &&
    out.blockMenu.separators === 0 &&
    out.topBarFound === true &&
    out.afterTopBarClick?.settingsPanelShown === true &&
    out.noLlmClientField === true &&
    out.noPendingBlockTasks === true;

  return JSON.stringify(out, null, 2);
})();
