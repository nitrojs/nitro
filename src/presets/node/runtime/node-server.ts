import "#nitro/virtual/polyfills";
import { NodeRequest, serve } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

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
const socketPath = process.env.NITRO_UNIX_SOCKET;

const _shutdownTimeout = Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10);
const gracefulShutdown =
  process.env.NITRO_SHUTDOWN_DISABLED === "true"
    ? false
    : _shutdownTimeout > 0
      ? { gracefulTimeout: _shutdownTimeout / 1000 }
      : undefined;

const nitroApp = useNitroApp();

const server = serve({
  port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  fetch: nitroApp.fetch,
  gracefulShutdown,
  node: socketPath ? { path: socketPath } : undefined,
});

if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
  server.node!.server!.on("upgrade", (req, socket, head) => {
    handleUpgrade(
      req,
      socket,
      head,
      // @ts-expect-error (upgrade is not typed)
      new NodeRequest({ req, upgrade: { socket, head } })
    );
  });
}

trapUnhandledErrors();
setupShutdownHooks();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
