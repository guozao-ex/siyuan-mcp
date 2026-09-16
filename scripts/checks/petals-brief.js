/**
 * 精简版插件状态查询：只返回名称与启用状态，避免输出插件源码。
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/petals-brief.js
 */
(async () => {
  const token = window.siyuan.config.api.token;
  const res = await fetch('/api/petal/loadPetals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Token ' + token,
    },
    body: JSON.stringify({ frontend: 'desktop' }),
  });
  const data = await res.json();
  const petals = (data.data && data.data.petals) || [];
  const app = window.siyuan.ws && window.siyuan.ws.app;
  const loaded = app && app.plugins ? app.plugins.map((p) => p.name) : [];

  return JSON.stringify(
    {
      code: data.code,
      petalCount: petals.length,
      petals: petals.map((p) => ({
        name: p.name,
        enabled: p.enabled,
        version: p.version,
        hasJs: Boolean(p.js && p.js.length),
      })),
      runtimeLoadedPlugins: loaded,
      myPluginInRuntime: loaded.includes('siyuan-plugin-mcp'),
    },
    null,
    2
  );
})();
