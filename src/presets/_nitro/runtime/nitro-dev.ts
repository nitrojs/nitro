import "#nitro/virtual/polyfills";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";

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
  plugins: [...tracingSrvxPlugins],
  // Let the dev runner attach the runtime-appropriate crossws adapter
  // (node/bun/deno) via `crossws/server` instead of hardcoding the Node.js one.
  websocket: import.meta._websocket
    ? ({ resolve: resolveWebsocketHooks } as AppEntry["websocket"])
    : undefined,
  ipc: {
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;
