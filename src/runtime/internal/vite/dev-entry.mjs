import "#nitro/virtual/polyfills";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { startScheduleRunner } from "#nitro/runtime/task";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

if (import.meta._tasks) {
  startScheduleRunner({});
}

export const handleUpgrade = ws?.handleUpgrade;

// Called by the dev worker when the runner shuts down (see `ipc.onClose` in `dev-worker.mjs`).
export const close = () => useNitroHooks().callHook("close");
