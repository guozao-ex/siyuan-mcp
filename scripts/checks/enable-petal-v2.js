/**
 * 用思源前端实际使用的参数启用插件。
 * 前端调用签名（来自 common/489 bundle 的 _setPluginEnabled）：
 *   fetchPost("/api/petal/setPetalEnabled", { packageName, enabled, app })
 *
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/enable-petal-v2.js
 */
(async () => {
  const token = window.siyuan.config.api.token;
  const appId = window.siyuan.ws && window.siyuan.ws.app ? window.siyuan.ws.app.appId : 'siyuan';

  const res = await fetch('/api/petal/setPetalEnabled', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Token ' + token,
    },
    body: JSON.stringify({ packageName: 'siyuan-plugin-mcp', enabled: true, app: appId }),
  });
  const data = await res.json();

  const d = data.data || {};
  return JSON.stringify(
    {
      appIdUsed: appId,
      code: data.code,
      msg: data.msg,
      returnedName: d.name,
      returnedEnabled: d.enabled,
      returnedDisplayName: d.displayName,
      jsBytes: d.js ? d.js.length : 0,
      cssBytes: d.css ? d.css.length : 0,
      i18nKeys: d.i18n ? Object.keys(d.i18n).length : 0,
    },
    null,
    2
  );
})();
