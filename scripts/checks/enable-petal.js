/**
 * 通过内核 API 启用指定插件。
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/enable-petal.js
 */
(async () => {
  const token = window.siyuan.config.api.token;
  const name = 'siyuan-plugin-mcp';
  const attempts = [];

  for (const path of ['/api/petal/setPetalEnabled', '/api/petal/setPetalEnabledV2', '/api/bazaar/setPetalEnabled']) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Token ' + token,
        },
        body: JSON.stringify({ name, enabled: true, frontend: 'desktop' }),
      });
      const text = await res.text();
      attempts.push({ path, status: res.status, body: text.slice(0, 300) });
    } catch (e) {
      attempts.push({ path, error: String(e) });
    }
  }

  const check = await fetch('/api/petal/loadPetals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Token ' + token },
    body: JSON.stringify({ frontend: 'desktop' }),
  });
  const checkData = await check.json();

  return JSON.stringify({ attempts, petalsAfter: checkData }, null, 2);
})();
