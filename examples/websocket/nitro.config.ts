import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  renderer: { static: true },
  experimental: {
    websocket: true,
  },
});
