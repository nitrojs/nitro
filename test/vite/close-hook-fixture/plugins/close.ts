import { appendFileSync } from "node:fs";
import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    const log = process.env.NITRO_TEST_CLOSE_LOG;
    if (!log) {
      return;
    }
    // Deliberately async: the assertion only holds if `close` hooks are awaited.
    await new Promise((resolve) => setTimeout(resolve, 50));
    appendFileSync(log, "runtime:close\n");
  });
});
