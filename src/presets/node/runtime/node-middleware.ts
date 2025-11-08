import "#nitro-internal-pollyfills";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "nitro/~internal/runtime/task";

const nitroApp = useNitroApp();

export const middleware = toNodeHandler(nitroApp.fetch);

// TODO
/** @experimental */
export const websocket = import.meta._websocket ? undefined : undefined;

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
