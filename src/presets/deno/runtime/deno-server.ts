import "#nitro-internal-polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/deno";
import wsAdapter from "crossws/adapters/deno";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#runtime/task";
import { trapUnhandledErrors } from "#runtime/error/hooks";
import { resolveWebsocketHooks } from "#runtime/app";
import { hasWebSocket } from "#nitro-internal-virtual/feature-flags";

const port =
  Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3000;

const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
// const socketPath = process.env.NITRO_UNIX_SOCKET; // TODO

const nitroApp = useNitroApp();

let _fetch = nitroApp.fetch;

if (hasWebSocket) {
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
});

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
