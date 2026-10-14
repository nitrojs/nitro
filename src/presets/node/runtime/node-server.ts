import "#nitro/virtual/polyfills";
import { startScheduleRunner } from "#nitro/runtime/task";
import { startNodeServer } from "./_server.ts";

const server = startNodeServer();

if (import.meta._tasks) {
  startScheduleRunner({ waitUntil: server.waitUntil });
}

export default {};
