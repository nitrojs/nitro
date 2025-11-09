import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  renderer: { static: true },
  features: {
    websocket: true,
  },
});
