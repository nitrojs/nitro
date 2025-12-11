import "#nitro-internal-polyfills";
import { toNodeHandler } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#runtime/task";
import { resolveWebsocketHooks } from "#runtime/app";
import { hasWebSocket } from "#nitro-internal-virtual/feature-flags";

const nitroApp = useNitroApp();

export const middleware = toNodeHandler(nitroApp.fetch);

const ws = hasWebSocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

export const handleUpgrade = ws?.handleUpgrade;

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
