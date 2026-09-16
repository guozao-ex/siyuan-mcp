/**
 * 列出思源内置图标中与 AI / 用户 相关的候选名，用于替换不存在的 iconAI / iconUser。
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/icon-candidates.js
 */
(() => {
  const ids = Array.from(document.querySelectorAll('symbol[id^="icon"]')).map((s) => s.id);
  const pick = (re) => ids.filter((id) => re.test(id)).sort();
  return JSON.stringify(
    {
      totalIcons: ids.length,
      aiRelated: pick(/ai|robot|sparkle|magic|wand|brain|smart|assist/i),
      userRelated: pick(/user|account|person|avatar|people|member|profile/i),
      chatRelated: pick(/chat|message|comment|dialog|talk|send|reply/i),
      editRelated: pick(/edit|pen|write|pencil/i),
    },
    null,
    2
  );
})();
