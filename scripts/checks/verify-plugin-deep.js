/**
 * 深度验证 siyuan-plugin-mcp 的加载结果。
 *
 * 覆盖：
 *  1. 插件实例与 i18n
 *  2. onload 是否走完（顶栏图标、命令注册）
 *  3. 块菜单事件是否真的绑上了（通过 EventBus.emit 触发 click-blockicon）
 *
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/verify-plugin-deep.js
 */
(() => {
  const siyuan = window.siyuan || {};
  const app = siyuan.ws && siyuan.ws.app;
  const mine = app && app.plugins ? app.plugins.find((p) => p.name === 'siyuan-plugin-mcp') : null;

  const result = {
    pluginFound: Boolean(mine),
    i18nSample: mine
      ? {
          openAiPanel: mine.i18n.openAiPanel,
          summarize: mine.i18n.summarize,
          settings: mine.i18n.settings,
          settingsIsString: typeof mine.i18n.settings === 'string',
        }
      : null,
  };

  if (!mine) return JSON.stringify(result, null, 2);

  // ---- 1. 顶栏图标：思源 addTopBar 会创建带 aria-label 的 .toolbar__item ----
  const topBarLabels = Array.from(document.querySelectorAll('.toolbar__item')).map((el) => ({
    label: el.getAttribute('aria-label') || el.getAttribute('data-title') || '',
    hasSvg: Boolean(el.querySelector('svg use')),
  }));
  result.topBarItems = topBarLabels;
  result.aiTopBarPresent = topBarLabels.some((t) => t.label === mine.i18n.openAiPanel);

  // ---- 2. 命令注册：addCommand 会把命令挂到 Plugin 实例的 commands 上 ----
  const cmds = Array.isArray(mine.commands) ? mine.commands : [];
  result.registeredCommands = cmds.map((c) => ({
    langKey: c.langKey,
    langText: c.langText,
    hotkey: c.hotkey,
    hasCallback: typeof c.callback === 'function',
  }));

  // ---- 3. 设置命令在全局命令表中的解析结果（验证 i18n 重复键修复的实际效果）----
  const globalCmds = siyuan.ws && siyuan.ws.app && siyuan.ws.app.commands;
  if (Array.isArray(globalCmds)) {
    const own = globalCmds.filter((c) => c.langKey === 'settings' && c.customHotkey !== undefined);
    result.globalSettingsCommands = own.length;
  }

  // ---- 4. 块菜单事件是否真的绑上了 ----
  // 构造一个假的 click-blockicon 事件，看插件会不会往菜单里加条目。
  // 使用一个真实存在的块 ID（若无文档则跳过）。
  let blockId = null;
  const anyBlock = document.querySelector('[data-node-id]');
  if (anyBlock) blockId = anyBlock.getAttribute('data-node-id');

  if (blockId) {
    const fakeMenu = {
      items: [],
      addSeparator() {
        this.items.push({ type: 'separator' });
      },
      addItem(item) {
        this.items.push({ type: 'item', label: item.label, icon: item.icon });
      },
    };
    const fakeElement = document.createElement('div');
    fakeElement.setAttribute('data-node-id', blockId);
    try {
      // 思源的 EventBus.emit 形如 emit(type, detail) 或 emit(customEvent)
      const evt = new CustomEvent('click-blockicon', {
        detail: { menu: fakeMenu, protyle: null, blockElements: [fakeElement] },
      });
      mine.eventBus.emit('click-blockicon', evt);
      result.blockMenuItems = fakeMenu.items;
      result.blockMenuInjected = fakeMenu.items.some((i) => i.type === 'item');
    } catch (e) {
      result.blockMenuError = String(e && e.message ? e.message : e);
    }
  } else {
    result.blockMenuSkipped = 'no [data-node-id] element in DOM (no document opened)';
  }

  return JSON.stringify(result, null, 2);
})();
