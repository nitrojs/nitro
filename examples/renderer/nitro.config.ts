import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  renderer: { handler: "./renderer" },
});
