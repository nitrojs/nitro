import "#nitro-internal-pollyfills";
import { useNitroApp, useNitroHooks } from "nitro/runtime";

import { trapUnhandledNodeErrors } from "nitro/runtime/internal";
import { startScheduleRunner } from "nitro/runtime/internal";
import { Server } from "node:http";
import { parentPort, threadId } from "node:worker_threads";

import wsAdapter from "crossws/adapters/node";
import { toNodeHandler } from "srvx/node";
import { getSocketAddress, isSocketSupported } from "get-port-please";

// Trap unhandled errors
trapUnhandledNodeErrors();

// Listen for shutdown signal from runner
parentPort?.on("message", (msg) => {
  if (msg && msg.event === "shutdown") {
    shutdown();
  }
});

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

const server = new Server(toNodeHandler(nitroApp.fetch));
let listener: Server | undefined;

listen()
  // eslint-disable-next-line unicorn/prefer-top-level-await
  .catch((error) => {
    console.error("Dev worker failed to listen:", error);
    return shutdown();
  });

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

// --- utils ---

async function listen() {
  const listenAddr = (await isSocketSupported())
    ? getSocketAddress({
        name: `nitro-dev-${threadId}`,
        pid: true,
        random: true,
      })
    : { port: 0, host: "localhost" };

  return new Promise<void>((resolve, reject) => {
    try {
      listener = server.listen(listenAddr, () => {
        const address = server.address();
        parentPort?.postMessage({
          event: "listen",
          address:
            typeof address === "string"
              ? { socketPath: address }
              : { host: "localhost", port: address?.port },
        });
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function shutdown() {
  server.closeAllConnections?.();
  await Promise.all([
    new Promise((resolve) => listener?.close(resolve)),
    nitroHooks.callHook("close"),
  ]).catch(console.error);
  parentPort?.postMessage({ event: "exit" });
}
