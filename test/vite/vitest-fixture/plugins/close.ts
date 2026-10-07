import { appendFileSync } from "node:fs";
import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", () => {
    if (process.env.NITRO_TEST_CLOSE_LOG) {
      appendFileSync(process.env.NITRO_TEST_CLOSE_LOG, "runtime:close\n");
    }
  });
});
