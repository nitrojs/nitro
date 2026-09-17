import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [
    nitro({
      serverDir: "./",
      experimental: {
        vite: {
          services: {
            render: { entry: entry("./app/entry-render.ts") },
            bad: { entry: entry("./app/entry-bad.ts") },
          },
        },
      },
    }),
  ],
});
