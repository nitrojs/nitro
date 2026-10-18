import { appendFileSync } from "node:fs";
import { defineConfig } from "nitro";

export default defineConfig({
  builder: "vite",
  prerender: { routes: ["/"] },
  hooks: {
    "prerender:init"() {
      const log = process.env.NITRO_TEST_CLI_BUILD_LOG;
      if (log) {
        appendFileSync(log, "prerender:init\n");
      }
    },
  },
});
