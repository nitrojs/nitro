import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro({ vite: { services: { api: { entry: "./api-entry.ts" } } } })],
  environments: {
    client: { build: { rollupOptions: { input: "./entry-client.ts" } } },
    // Built before `ssr`, which imports the same `?assets` module
    api: {},
    ssr: { build: { rollupOptions: { input: "./entry-server.ts" } } },
  },
});
