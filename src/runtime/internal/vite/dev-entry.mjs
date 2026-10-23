import "#nitro/virtual/polyfills";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import {
  builtinWorkerExports,
  serverEntryExports as userExports,
} from "#nitro/virtual/server-entry";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;

export const websocket = import.meta._websocket ? { resolve: resolveWebsocketHooks } : undefined;

if (import.meta._tasks) {
  startScheduleRunner({});
}

// Named exports of the server entry and the preset's built-in ones: the Worker exports of the
// miniflare runner (see `resolveExports` in `dev-worker.mjs`). Namespaced so they are not read as
// server options.
export const serverEntryExports = { ...builtinWorkerExports, ...userExports };

// Called by the dev worker when the runner shuts down (see `ipc.onClose` in `dev-worker.mjs`).
export const close = () => useNitroHooks().callHook("close");
