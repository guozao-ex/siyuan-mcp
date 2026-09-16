import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    svelte(),
    // public/ 下的资源（icon.png、preview.png、i18n/*.json）由 Vite 的 publicDir
    // 机制自动拷贝到 dist/ 根目录，因此不需要在 staticCopy 中重复声明。
    // 这里只处理不在 public/ 下的产物：插件清单与说明文档。
    viteStaticCopy({
      targets: [
        { src: "plugin.json", dest: "./" },
        { src: "README*.md", dest: "./" },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["siyuan"],
      output: {
        entryFileNames: "index.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        },
      },
    },
  },
});
