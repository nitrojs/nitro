import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  base: "/subdir/",
  plugins: [
    nitro({
      baseURL: "/subdir/",
      serverDir: "./",
      serveStatic: false,
    }),
  ],
});
