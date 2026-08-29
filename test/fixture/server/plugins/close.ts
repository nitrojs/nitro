import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    if (globalThis.process?.env?.NITRO_TEST_CLOSE_HOOK) {
      // Deliberately async: the shutdown test asserts the marker is printed
      // before the process exits, which only holds when `close` hooks are awaited
      await new Promise((resolve) => setTimeout(resolve, 250));
      console.log("[fixture] close hook called");
    }
  });
});
