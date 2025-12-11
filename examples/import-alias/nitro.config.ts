import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
  experimental: {
    tsconfigPaths: true,
  },
});
