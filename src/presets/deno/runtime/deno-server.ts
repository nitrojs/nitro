import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/deno";
import wsAdapter from "crossws/adapters/deno";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { setupShutdownHooks } from "#nitro/runtime/shutdown";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
const port = Number.isNaN(_parsedPort) ? 3000 : _parsedPort;

const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;

const _shutdownTimeout = Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10);
const gracefulShutdown =
  process.env.NITRO_SHUTDOWN_DISABLED === "true"
    ? false
    : _shutdownTimeout > 0
      ? { gracefulTimeout: _shutdownTimeout / 1000 }
      : undefined;

const nitroApp = useNitroApp();

let _fetch = nitroApp.fetch;

if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return handleUpgrade(req, req.runtime!.deno!.info);
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
});

trapUnhandledErrors();
setupShutdownHooks();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
