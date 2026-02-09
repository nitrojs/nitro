import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/bun";
import wsAdapter from "crossws/adapters/bun";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
const port = Number.isNaN(_parsedPort) ? 3000 : _parsedPort;
const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const socketPath = process.env.NITRO_UNIX_SOCKET;

const _shutdownTimeout = Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10);
const gracefulShutdown =
  process.env.NITRO_SHUTDOWN_DISABLED === "true"
    ? false
    : _shutdownTimeout > 0
      ? { gracefulTimeout: _shutdownTimeout / 1000 }
      : undefined;

const nitroApp = useNitroApp();

let _fetch = nitroApp.fetch;

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

if (import.meta._websocket) {
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(req, req.runtime!.bun!.server) as Promise<Response>;
    }
    return nitroApp.fetch(req);
  };
}

serve({
  port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  fetch: _fetch,
  gracefulShutdown,
  bun: {
    unix: socketPath,
    websocket: import.meta._websocket ? ws?.websocket : undefined,
  },
});

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
