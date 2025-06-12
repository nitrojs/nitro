import "#nitro-internal-pollyfills";
import { tmpdir } from "node:os";
import { useNitroApp } from "nitro/runtime";
import { runTask } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";
import { startScheduleRunner } from "nitro/runtime/internal";
import { scheduledTasks, tasks } from "#nitro-internal-virtual/tasks";
import { Server } from "node:http";
import { join } from "node:path";
import nodeCrypto from "node:crypto";
import { parentPort, threadId } from "node:worker_threads";
import { defineHandler, getRouterParam } from "h3";
import wsAdapter from "crossws/adapters/node";
import { toNodeHandler } from "srvx/node";

// globalThis.crypto support for Node.js 18
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto as unknown as Crypto;
}

const { NITRO_NO_UNIX_SOCKET, NITRO_DEV_WORKER_ID } = process.env;

// Trap unhandled errors
trapUnhandledNodeErrors();

// Listen for shutdown signal from runner
parentPort?.on("message", (msg) => {
  if (msg && msg.event === "shutdown") {
    shutdown();
  }
});

const nitroApp = useNitroApp();

const server = new Server(toNodeHandler(nitroApp.h3App.fetch));
let listener: Server | undefined;

listen()
  .catch(() => listen(true /* use random port */))
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

function listen(
  useRandomPort: boolean = Boolean(
    NITRO_NO_UNIX_SOCKET ||
      process.versions.webcontainer ||
      ("Bun" in globalThis && process.platform === "win32")
  )
) {
  return new Promise<void>((resolve, reject) => {
    try {
      listener = server.listen(useRandomPort ? 0 : getSocketAddress(), () => {
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

function getSocketAddress() {
  const socketName = `nitro-worker-${process.pid}-${threadId}-${NITRO_DEV_WORKER_ID}-${Math.round(Math.random() * 10_000)}.sock`;
  // Windows: pipe
  if (process.platform === "win32") {
    return join(String.raw`\\.\pipe`, socketName);
  }
  // Linux: abstract namespace
  if (process.platform === "linux") {
    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
    if (nodeMajor >= 20) {
      return `\0${socketName}`;
    }
  }
  // Unix socket
  return join(tmpdir(), socketName);
}

async function shutdown() {
  server.closeAllConnections?.();
  await Promise.all([
    new Promise((resolve) => listener?.close(resolve)),
    nitroApp.hooks.callHook("close").catch(console.error),
  ]);
  parentPort?.postMessage({ event: "exit" });
}
