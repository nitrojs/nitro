import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { startScheduleRunner } from "nitro/runtime/internal";

import wsAdapter from "crossws/adapters/bun";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

// @ts-expect-error
const server = Bun.serve({
  port: process.env.NITRO_PORT || process.env.PORT || 3000,
  websocket: import.meta._websocket ? ws!.websocket : (undefined as any),
  async fetch(request: Request, server: any) {
    // https://crossws.unjs.io/adapters/bun
    if (
      import.meta._websocket &&
      request.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleUpgrade(request, server);
    }

    return nitroApp.fetch(request, undefined, {
      _platform: { bun: { request, server } },
    });
  },
});

console.log(`Listening on http://localhost:${server.port}...`);

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
