import { appendFileSync } from "node:fs";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    nitro({
      serverDir: "./",
      hooks: {
        close() {
          const log = process.env.NITRO_TEST_CLOSE_LOG;
          if (log) {
            appendFileSync(log, "build:close\n");
          }
        },
      },
    }),
  ],
});
