import "#nitro/virtual/polyfills";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

import type { AppEntry } from "env-runner";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({});
}

export default {
  fetch: nitroApp.fetch,
  plugins: import.meta._websocket
    ? [
        (server) => {
          const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
          server.node?.server?.on("upgrade", handleUpgrade);
        },
      ]
    : undefined,
  ipc: {
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;
