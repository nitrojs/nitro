import "#nitro/virtual/polyfills";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { startScheduleRunner } from "#nitro/runtime/task";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;

// crossws options (not an adapter): the dev worker hands them to the adapter that matches the
// runtime it is executing in, so the same entry works on Node, Bun and Deno (#3939).
export const websocket = import.meta._websocket ? { resolve: resolveWebsocketHooks } : undefined;

if (import.meta._tasks) {
  startScheduleRunner({});
}

// Called by the dev worker when the runner shuts down (see `ipc.onClose` in `dev-worker.mjs`).
export const close = () => useNitroHooks().callHook("close");
