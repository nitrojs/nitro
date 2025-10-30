import "#nitro-internal-pollyfills";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/runtime";
import { startScheduleRunner } from "nitro/runtime/internal";

const nitroApp = useNitroApp();

export const middleware = toNodeHandler(nitroApp.fetch);

// TODO
/** @experimental */
export const websocket = import.meta._websocket ? undefined : undefined;

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
