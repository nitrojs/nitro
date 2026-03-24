import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro()],
  environments: {
    client: {
      build: { rollupOptions: { input: "./src/entry-client.ts" } },
    },
  },
  optimizeDeps: {
    exclude: [
      "@arrow-js/core",
      "@arrow-js/framework",
      "@arrow-js/ssr",
      "@arrow-js/hydrate",
    ],
  },
  ssr: {
    noExternal: [
      "@arrow-js/core",
      "@arrow-js/framework",
      "@arrow-js/ssr",
      "@arrow-js/hydrate",
    ],
  },
});
