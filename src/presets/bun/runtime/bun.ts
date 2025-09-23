import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { startScheduleRunner } from "nitro/runtime/internal";

import wsAdapter from "crossws/adapters/bun";
import type { ServerRequest } from "srvx";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? // @ts-expect-error
    wsAdapter(nitroApp.h3App.websocket)
  : undefined;

// @ts-expect-error
const server = Bun.serve({
  port: process.env.NITRO_PORT || process.env.PORT || 3000,
  host: process.env.NITRO_HOST || process.env.HOST,
  websocket: import.meta._websocket ? ws!.websocket : (undefined as any),
  async fetch(bunReq: Request, server: any) {
    // srvx compatibility
    const req = bunReq as ServerRequest;
    req.runtime ??= { name: "bun" };
    req.runtime.bun ??= { server } as any;

    // https://crossws.unjs.io/adapters/bun
    if (import.meta._websocket && req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(req, server);
    }

    return nitroApp.fetch(req);
  },
});

console.log(`Listening on ${server.url}...`);

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
