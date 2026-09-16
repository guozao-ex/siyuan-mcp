/**
 * 检查插件用到的思源内置图标符号是否真的存在。
 * 用法：node scripts/cdp-eval.mjs --file=scripts/checks/icons.js
 */
(() => {
  const icons = [
    'iconAI', // 顶栏
    'iconSparkles', // 块菜单 - 总结
    'iconEdit', // 块菜单 - 续写
    'iconRefresh', // 块菜单 - 改进
    'iconClose', // 面板/设置关闭
    'iconSettings', // 设置面板标题
    'iconUser', // 对话头像
    'iconSend', // 发送按钮
    'iconMcpSettings', // 插件自定义注册的
  ];
  const result = {};
  for (const id of icons) {
    result[id] = document.getElementById(id) !== null;
  }
  const allSymbols = document.querySelectorAll('symbol[id^="icon"]').length;
  return JSON.stringify({ symbolsInDocument: allSymbols, icons: result }, null, 2);
})();
