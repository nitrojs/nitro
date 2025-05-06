import "#nitro-internal-pollyfills";
import { fstatSync } from "node:fs";
import { Server as HttpServer } from "node:http";
import { Server as HttpsServer } from "node:https";
import type { ListenOptions } from "node:net";
import { pid } from "node:process";
import wsAdapter from "crossws/adapters/node";
import { toNodeListener } from "h3";
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
    ? new HttpsServer({ key, cert }, toNodeListener(nitroApp.h3App))
    : new HttpServer(toNodeListener(nitroApp.h3App));

const SD_LISTEN_FDS_START = 3;

function getListenFds(): number[] {
  // Implement sd_listen_fds handling from systemd which passes
  // already opened and configured sockets to the server starting at FD 3.
  // See https://systemd.io/SD_LISTEN_FDS/
  const listen_pid = Number.parseInt(process.env.LISTEN_PID || "", 10);
  const listen_fds = Number.parseInt(process.env.LISTEN_FDS || "", 10);
  delete process.env.LISTEN_PID;
  delete process.env.LISTEN_FDS;
  delete process.env.LISTEN_FDNAMES;

  if (listen_pid !== pid) return [];
  if (listen_fds <= 0) return [];

  // Ideally, we would set the FD_CLOEXEC flag on all passed the FDs.
  // However, this requires calling out to fcntl which is not available in Node.
  return Array.from({ length: listen_fds }, (_, i) => SD_LISTEN_FDS_START + i);
}

function getServerListenOptions(): ListenOptions | { fd: number } {
  const fds = getListenFds();
  if (fds.length) {
    if (fds.length > 1) {
      console.warn(
        `Multiple file descriptors (${fds.length}) passed to the server. Only the first one will be used.`
      );
    }

    const fd = fds[0];
    if (!fstatSync(fd).isSocket) {
      console.error(
        `File descriptor ${fd} is not a socket. Ignoring it and using fallback listeners.`
      );
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }

    // We would also like to check SO_TYPE and SO_ACCEPTCONN to confirm
    // that the socket is configured correctly (type SOCK_STREAM, and listening),
    // but this requires getsockopt which is not available in Node either.
    return { fd };
  }

  const path = process.env.NITRO_UNIX_SOCKET;
  if (path) {
    return { path };
  }

  const port = Number.parseInt(
    process.env.NITRO_PORT || process.env.PORT || "3000"
  );
  const host = process.env.NITRO_HOST || process.env.HOST;
  return { port, host };
}

// @ts-ignore
const listener = server.listen(getServerListenOptions(), (err) => {
  if (err) {
    console.error(err);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
  const addressInfo = listener.address();
  if (addressInfo === null) {
    console.log("Failed to get address info");
    return;
  }
  if (typeof addressInfo === "string") {
    console.log(`Listening on unix socket ${addressInfo}`);
    return;
  }
  const protocol = cert && key ? "https" : "http";
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
  const { handleUpgrade } = wsAdapter(nitroApp.h3App.websocket);
  server.on("upgrade", handleUpgrade);
}

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
