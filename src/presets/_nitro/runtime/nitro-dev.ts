import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { runTask } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";
import { startScheduleRunner } from "nitro/runtime/internal";
import { scheduledTasks, tasks } from "#nitro-internal-virtual/tasks";
import { Server } from "node:http";
import nodeCrypto from "node:crypto";
import { parentPort, threadId } from "node:worker_threads";
import { defineHandler, getRouterParam } from "h3";
import wsAdapter from "crossws/adapters/node";
import { toNodeHandler } from "srvx/node";
import { getSocketAddress, isSocketSupported } from "get-port-please";

// globalThis.crypto support for Node.js 18
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto as unknown as Crypto;
}

// Trap unhandled errors
trapUnhandledNodeErrors();

// Listen for shutdown signal from runner
parentPort?.on("message", (msg) => {
  if (msg && msg.event === "shutdown") {
    shutdown();
  }
});

const nitroApp = useNitroApp();

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

// Register tasks handlers
nitroApp.h3App.get(
  "/_nitro/tasks",
  defineHandler(async (event) => {
    const _tasks = await Promise.all(
      Object.entries(tasks).map(async ([name, task]) => {
        const _task = await task.resolve?.();
        return [name, { description: _task?.meta?.description }];
      })
    );
    return {
      tasks: Object.fromEntries(_tasks),
      scheduledTasks,
    };
  })
);

nitroApp.h3App.use(
  "/_nitro/tasks/:name",
  defineHandler(async (event) => {
    const name = getRouterParam(event, "name") as string;
    const body = (await event.req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const payload = {
      ...Object.fromEntries(event.url.searchParams.entries()),
      ...body,
    };
    return await runTask(name, { payload });
  })
);

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
    nitroApp.hooks.callHook("close").catch(console.error),
  ]);
  parentPort?.postMessage({ event: "exit" });
}
