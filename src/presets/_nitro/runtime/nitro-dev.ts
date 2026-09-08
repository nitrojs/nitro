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
  // crossws options (not an adapter): the dev runner hands them to the WebSocket adapter of the
  // runtime it is executing in, so the same entry works on Node, Bun and Deno (#3939).
  websocket: import.meta._websocket
    ? ({ resolve: resolveWebsocketHooks } as AppEntry["websocket"])
    : undefined,
  ipc: {
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;
