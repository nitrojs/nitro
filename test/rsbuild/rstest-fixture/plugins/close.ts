import { appendFileSync } from "node:fs";
import { definePlugin, serverFetch } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    if (process.env.NITRO_TEST_CLOSE_LOG) {
      // The app must still be reachable while `close` hooks run
      const res = await serverFetch("/hello");
      appendFileSync(process.env.NITRO_TEST_CLOSE_LOG, `runtime:close:${res.status}\n`);
    }
  });
});
