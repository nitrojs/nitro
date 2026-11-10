import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro()],
  environments: {
    client: { build: { rollupOptions: { input: "./entry-client.ts" } } },
    ssr: { build: { rollupOptions: { input: "./entry-server.ts" } } },
  },
});
