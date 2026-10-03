import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  build: { outDir: "dist/public" },
  plugins: [nitro({ output: { dir: "dist" } })],
});
