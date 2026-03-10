import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  devServer: {
    runner: "miniflare",
  },
});
