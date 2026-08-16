import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", () => {
    if (globalThis.process?.env?.NITRO_TEST_CLOSE_HOOK) {
      console.log("[fixture] close hook called");
    }
  });
});
