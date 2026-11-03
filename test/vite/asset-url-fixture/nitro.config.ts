import { defineConfig } from "nitro";

export default defineConfig({
  preset: "standard",
  serverDir: "./",
  services: { api: { entry: "./service.ts" } },
});
