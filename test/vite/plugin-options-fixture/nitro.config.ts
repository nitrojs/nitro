import { defineConfig } from "nitro";

export default defineConfig({
  vite: {
    assetsImport: false,
    services: { api: { entry: "./api-entry.ts" } },
  },
});
