import { defineConfig } from "nitro";

export default defineConfig({
  preset: "standard",
  serverDir: "./",
  services: { ssr: { entry: "./service.ts" } },
});
