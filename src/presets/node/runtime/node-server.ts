import "#nitro-internal-pollyfills";
import { serve } from "srvx/node";
import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "nitro/~internal/runtime/task";
import { trapUnhandledErrors } from "nitro/~internal/runtime/error/hooks";

const port =
  Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3000;

const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
// const socketPath = process.env.NITRO_UNIX_SOCKET; // TODO

// if (import.meta._websocket) // TODO

const nitroApp = useNitroApp();

serve({
  port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  fetch: nitroApp.fetch,
});

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
