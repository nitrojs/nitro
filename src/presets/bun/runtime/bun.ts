import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import { startScheduleRunner } from "nitropack/runtime/internal";

import wsAdapter from "crossws/adapters/bun";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

// @ts-expect-error
const server = Bun.serve({
  port: process.env.NITRO_PORT || process.env.PORT || 3000,
  host: process.env.NITRO_HOST || process.env.HOST,
  websocket: import.meta._websocket ? ws!.websocket : (undefined as any),
  async fetch(req: Request, server: any) {
    // https://crossws.unjs.io/adapters/bun
    if (import.meta._websocket && req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(req, server);
    }

    const url = new URL(req.url);

    let body;
    if (req.body) {
      body = await req.arrayBuffer();
    }

    return nitroApp.localFetch(url.pathname + url.search, {
      host: url.hostname,
      protocol: url.protocol,
      headers: req.headers,
      method: req.method,
      redirect: req.redirect,
      body,
    });
  },
});

console.log(`Listening on ${server.url}...`);

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
