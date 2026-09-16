/**
 * 插件共享类型与常量。
 *
 * 为什么单独放在 .ts 文件里：
 * Svelte 4 的组件模块在 TypeScript 视角下只导出组件类本身，
 * 在 `<script lang="ts">` 里 `export interface` 对 .ts 文件不可见
 * （会报 TS2614: Module '"*.svelte"' has no exported member）。
 * 因此凡是需要被 .ts 引用的类型，都必须定义在普通 .ts 文件里。
 */

/** 插件的持久化设置 */
export interface PluginSettings {
  /** MCP 服务器的 HTTP 地址 */
  mcpServerUrl: string;
  /** 访问 MCP 服务器所需的 Token（留空表示服务器未开启认证） */
  apiToken: string;
  /** 插件加载时是否自动连接 MCP 服务器 */
  autoConnect: boolean;
}

/** 设置的默认值（也是"重置为默认"的目标值） */
export const DEFAULT_SETTINGS: PluginSettings = {
  mcpServerUrl: 'http://127.0.0.1:3000',
  apiToken: '',
  autoConnect: true,
};
