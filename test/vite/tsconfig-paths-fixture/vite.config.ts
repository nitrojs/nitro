import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [nitro()],
  resolve: {
    alias: {
      "@vite-aliased": fileURLToPath(new URL("app/vite-aliased.ts", import.meta.url)),
    },
  },
});
