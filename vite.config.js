import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === "true" ? "/RentMatch/" : "/",
  build: {
    outDir: resolve(process.cwd(), "wwwroot"),
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        template: resolve(process.cwd(), "index.template.html"),
        app: resolve(process.cwd(), "src/main.jsx"),
      },
      output: {
        entryFileNames: "js/[name]-[hash].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "css/[name]-[hash][extname]" : "assets/[name]-[hash][extname]"
      }
    }
  }
});
