import { definePlugin } from "nitro";
import { mark, setReady, waitForRelease } from "../../events.ts";
import { fixtureError } from "../../errors.ts";

mark("plugin:module");
if (process.env.TASK_CLI_MODULE_THROW) {
  throw new Error("fixture module failed");
}

export default definePlugin((app) => {
  globalThis.__taskCliFixtureApp = app;
  mark("plugin:init");
  app.hooks.hook("close", async () => {
    mark("plugin:close");
    try {
      if (process.env.TASK_CLI_CLOSE_ABORT_TASK) {
        globalThis.__taskCliRejectPending?.(new Error("fixture task aborted by cleanup"));
      }
      if (process.env.TASK_CLI_CLOSE_WAIT) {
        const release = waitForRelease();
        mark("plugin:closing");
        await release;
      }
      await Promise.resolve();
      if (process.env.TASK_CLI_CLOSE_REJECT) {
        throw fixtureError("fixture cleanup rejected");
      }
    } finally {
      if (process.env.TASK_CLI_ERROR_BYTES) mark("plugin:close:complete");
    }
  });
  if (process.env.TASK_CLI_INIT_THROW) {
    throw new Error("fixture initialization threw");
  }
  return (async () => {
    if (process.env.TASK_CLI_INIT_WAIT) {
      const release = waitForRelease();
      mark("plugin:waiting");
      await release;
    }
    await Promise.resolve();
    if (process.env.TASK_CLI_INIT_REJECT) {
      throw new Error("fixture ready rejected");
    }
    setReady();
    mark("plugin:ready");
  })();
});
