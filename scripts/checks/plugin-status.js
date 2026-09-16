/**
 * 检查思源插件 siyuan-plugin-mcp 的加载状态。
 *
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/plugin-status.js
 * 前置：思源以 --remote-debugging-port=9222 启动。
 */
(() => {
  const siyuan = window.siyuan || {};
  const app = siyuan.ws && siyuan.ws.app;
  const all = app && app.plugins ? app.plugins : [];
  const names = all.map((p) => p.name);
  const mine = all.find((p) => p.name === 'siyuan-plugin-mcp');

  // 该插件注册的顶栏图标（title 来自 i18n 的 openAiPanel）
  const topBarTitles = Array.from(document.querySelectorAll('.toolbar__icon')).map(
    (el) => el.getAttribute('aria-label') || el.getAttribute('data-title') || el.title || ''
  );

  return JSON.stringify(
    {
      kernelReady: siyuan.isReady,
      workspaceDir: siyuan.config && siyuan.config.system ? siyuan.config.system.workspaceDir : null,
      pluginCount: all.length,
      loadedPlugins: names,
      myPluginLoaded: Boolean(mine),
      myPluginInfo: mine
        ? {
            name: mine.name,
            displayName: mine.displayName,
            enabled: mine.enabled,
            hasEventBus: Boolean(mine.eventBus),
            i18nKeys: mine.i18n ? Object.keys(mine.i18n).length : 0,
            i18nOpenAiPanel: mine.i18n ? mine.i18n.openAiPanel : undefined,
            i18nSettings: mine.i18n ? mine.i18n.settings : undefined,
          }
        : null,
      topBarIconCount: topBarTitles.length,
    },
    null,
    2
  );
})();
