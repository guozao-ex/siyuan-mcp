/**
 * 查询思源内核的插件（petal）清单与启用状态。
 *
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/petals.js
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
  if (data.code !== 0) return JSON.stringify({ httpStatus: res.status, error: data }, null, 2);
  const petals = (data.data && data.data.petals) || [];
  return JSON.stringify(
    {
      httpStatus: res.status,
      total: petals.length,
      petals: petals.map((p) => ({
        name: p.name,
        enabled: p.enabled,
        installed: p.installed,
        version: p.version,
        outdated: p.outdated,
      })),
    },
    null,
    2
  );
})();
