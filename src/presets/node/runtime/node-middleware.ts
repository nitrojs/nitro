import "#nitro/virtual/polyfills";
import { toNodeHandler } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const nitroApp = useNitroApp();

export const middleware = toNodeHandler(nitroApp.fetch);

const ws = import.meta._websocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

export const handleUpgrade = ws?.handleUpgrade;

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
