import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/bun";
import wsAdapter from "crossws/adapters/bun";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { hasWebSocket } from "#nitro/virtual/feature-flags";

const port =
  Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3000;
const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
// const socketPath = process.env.NITRO_UNIX_SOCKET; // TODO

const nitroApp = useNitroApp();

let _fetch = nitroApp.fetch;

const ws = hasWebSocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

if (hasWebSocket) {
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(
        req,
        req.runtime!.bun!.server
      ) as Promise<Response>;
    }
    return nitroApp.fetch(req);
  };
}

serve({
  port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  fetch: _fetch,
  bun: {
    websocket: hasWebSocket ? ws?.websocket : undefined,
  },
});

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
