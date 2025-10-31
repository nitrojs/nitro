import "#nitro-internal-pollyfills";
import { serve } from "srvx/bun";
import { useNitroApp } from "nitro/runtime";
import { trapUnhandledErrors } from "nitro/runtime/internal";

const port =
  Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3000;
const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;

if (port < 0 || port > 65535) {
  throw new Error("Port number range is must between 0 to 65535");
}

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
  const { startScheduleRunner } = await import("nitro/runtime/internal");
  startScheduleRunner();
}

export default {};
