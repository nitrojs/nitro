import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  externals: {
    inline: ["shiki/core"],
  },
});
