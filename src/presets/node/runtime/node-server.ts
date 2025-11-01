import "#nitro-internal-pollyfills";
import cluster from "node:cluster";
import { serve } from "srvx/node";
import { useNitroApp } from "nitro/runtime";
import { trapUnhandledErrors } from "nitro/runtime/internal";

const port =
  Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3000;

const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
// const socketPath = process.env.NITRO_UNIX_SOCKET; // TODO

const clusterId = cluster.isWorker && process.env.WORKER_ID;
if (clusterId) {
  console.log(`Worker #${clusterId} started`);
}

// if (import.meta._websocket) // TODO

const nitroApp = useNitroApp();

serve({
  port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  node: { reusePort: !!clusterId },
  silent: clusterId ? clusterId !== "1" : undefined,
  fetch: nitroApp.fetch,
});

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  const { startScheduleRunner } = await import("nitro/runtime/internal");
  startScheduleRunner();
}

export default {};
