import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Svelte 编译配置。
 *
 * 必须启用 vitePreprocess：组件的 <script lang="ts"> 需要 TypeScript 预处理，
 * <style lang="scss"> 需要 SCSS 预处理（由 vite 的 sass 支持）。
 * 缺少这一步时构建会报 "Did you forget to add a TypeScript preprocessor?"。
 */
export default {
  preprocess: vitePreprocess(),
};
