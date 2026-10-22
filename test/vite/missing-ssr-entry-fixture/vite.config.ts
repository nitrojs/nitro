import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro({ prerender: { routes: ["/"] } })],
  environments: {
    client: {
      build: { rollupOptions: { input: "src/entry-client.ts" } },
    },
  },
});
