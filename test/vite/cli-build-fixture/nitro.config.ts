import { appendFileSync } from "node:fs";
import { defineConfig } from "nitro";

export default defineConfig({
  builder: "vite",
  prerender: { routes: ["/"] },
  hooks: {
    "prerender:init": () => log("prerender:init"),
    close: () => log("close"),
  },
});

function log(event: string) {
  const logFile = process.env.NITRO_TEST_CLI_BUILD_LOG;
  if (logFile) {
    appendFileSync(logFile, `${event}\n`);
  }
}
