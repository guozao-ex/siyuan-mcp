/**
 * 验证顶栏图标的符号引用是否指向一个真实存在的内置图标。
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/verify-topbar-icon.js
 */
(() => {
  const app = window.siyuan && window.siyuan.ws && window.siyuan.ws.app;
  const mine = app && app.plugins ? app.plugins.find((p) => p.name === 'siyuan-plugin-mcp') : null;
  if (!mine) return JSON.stringify({ error: 'plugin not loaded' }, null, 2);

  const label = mine.i18n ? mine.i18n.openPluginSettings : 'MCP 插件设置';
  const el = document.querySelector(`.toolbar__item[aria-label="${label}"]`);
  if (!el) return JSON.stringify({ error: 'topbar icon not found', label }, null, 2);

  const use = el.querySelector('svg use');
  const href = use ? use.getAttribute('xlink:href') || use.getAttribute('href') : null;
  const symbolId = href ? href.replace('#', '') : null;

  return JSON.stringify(
    {
      topBarLabel: label,
      symbolRef: href,
      symbolExists: symbolId ? document.getElementById(symbolId) !== null : false,
      iconRendered: (() => {
        const svg = el.querySelector('svg');
        if (!svg) return null;
        const r = svg.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      })(),
    },
    null,
    2
  );
})();
