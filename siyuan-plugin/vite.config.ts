import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        { src: "plugin.json", dest: "./" },
        { src: "preview.png", dest: "./" },
        { src: "icon.png", dest: "./" },
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
