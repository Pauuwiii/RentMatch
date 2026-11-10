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
      output: {
        entryFileNames: "js/rentmatch.js",
        chunkFileNames: "js/[name].js",
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "css/rentmatch.css" : "assets/[name][extname]"
      }
    }
  }
});
