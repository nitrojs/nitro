import "#nitro-internal-pollyfills";
import { Server as HttpServer } from "node:http";
import { Server as HttpsServer } from "node:https";
import type { AddressInfo } from "node:net";
import wsAdapter from "crossws/adapters/node";
import destr from "destr";
import { toNodeHandler } from "srvx/node";
import { useNitroApp, useRuntimeConfig } from "nitro/runtime";
import {
  setupGracefulShutdown,
  startScheduleRunner,
  trapUnhandledNodeErrors,
} from "nitro/runtime/internal";

const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;

const nitroApp = useNitroApp();

const server =
  cert && key
    ? new HttpsServer({ key, cert }, toNodeHandler(nitroApp.h3App.fetch))
    : new HttpServer(toNodeHandler(nitroApp.h3App.fetch));

const port = (destr(process.env.NITRO_PORT || process.env.PORT) ||
  3000) as number;
const host = process.env.NITRO_HOST || process.env.HOST;

const path = process.env.NITRO_UNIX_SOCKET;

// @ts-ignore
const listener = server.listen(path ? { path } : { port, host }, (err) => {
  if (err) {
    console.error(err);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
  const protocol = cert && key ? "https" : "http";
  const addressInfo = listener.address() as AddressInfo;
  if (typeof addressInfo === "string") {
    console.log(`Listening on unix socket ${addressInfo}`);
    return;
  }
  const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\/$/, "");
  const url = `${protocol}://${
    addressInfo.family === "IPv6"
      ? `[${addressInfo.address}]`
      : addressInfo.address
  }:${addressInfo.port}${baseURL}`;
  console.log(`Listening on ${url}`);
});

// Trap unhandled errors
trapUnhandledNodeErrors();

// Graceful shutdown
setupGracefulShutdown(listener, nitroApp);

// Websocket support
// https://crossws.unjs.io/adapters/node
if (import.meta._websocket) {
  // @ts-expect-error
  const { handleUpgrade } = wsAdapter(nitroApp.h3App.websocket);
  server.on("upgrade", handleUpgrade);
}

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
