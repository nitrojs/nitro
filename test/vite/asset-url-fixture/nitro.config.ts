import { defineConfig } from "nitro";

export default defineConfig({
  preset: "standard",
  serverDir: "./",
  vite: {
    services: { api: { entry: "./service.ts" } },
  },
});
