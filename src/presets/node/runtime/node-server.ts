import "#nitro-internal-pollyfills";
import wsAdapter from "crossws/adapters/node";
import cluster from "node:cluster";
import { serve } from "srvx/node";
import { useNitroApp } from "nitro/runtime";
import { startScheduleRunner } from "nitro/runtime/internal";

const port =
  Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3000;

const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
// const path = process.env.NITRO_UNIX_SOCKET; // TODO

const clusterId = cluster.isWorker && process.env.WORKER_ID;
if (clusterId) {
  console.log(`Worker #${clusterId} started`);
}

const nitroApp = useNitroApp();

const server = serve({
  port: port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  node: { reusePort: !!clusterId },
  silent: clusterId ? clusterId !== "1" : undefined,
  fetch: nitroApp.fetch,
});

// Websocket support
// https://crossws.unjs.io/adapters/node
if (import.meta._websocket) {
  // @ts-expect-error
  const { handleUpgrade } = wsAdapter(nitroApp.h3App.websocket);
  server.node!.server!.on("upgrade", handleUpgrade);
}

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
