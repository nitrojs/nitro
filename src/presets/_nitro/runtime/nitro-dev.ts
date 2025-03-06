import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import { runTask } from "nitropack/runtime";
import { trapUnhandledNodeErrors } from "nitropack/runtime/internal";
import { startScheduleRunner } from "nitropack/runtime/internal";
import { scheduledTasks, tasks } from "#nitro-internal-virtual/tasks";
import { Server } from "node:http";
import { join } from "node:path";
import { parentPort, threadId } from "node:worker_threads";
import wsAdapter from "crossws/adapters/node";
import {
  defineEventHandler,
  getQuery,
  getRouterParam,
  readBody,
  toNodeListener,
} from "h3";

const {
  NITRO_NO_UNIX_SOCKET,
  NITRO_DEV_WORKER_DIR = ".",
  NITRO_DEV_WORKER_ID,
} = process.env;

// Trap unhandled errors
trapUnhandledNodeErrors();

// Listen for shutdown signal from runner
parentPort?.on("message", (msg) => {
  if (msg && msg.event === "shutdown") {
    shutdown();
  }
});

const nitroApp = useNitroApp();

const server = new Server(toNodeListener(nitroApp.h3App));
let listener: Server | undefined;

listen()
  .catch(() => listen(true /* use random port */))
  // eslint-disable-next-line unicorn/prefer-top-level-await
  .catch((error) => {
    console.error("Failed to listen on any port", error);
    return shutdown();
  });

// https://crossws.unjs.io/adapters/node
if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter(nitroApp.h3App.websocket);
  server.on("upgrade", handleUpgrade);
}

// Register tasks handlers
nitroApp.router.get(
  "/_nitro/tasks",
  defineEventHandler(async (event) => {
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
nitroApp.router.use(
  "/_nitro/tasks/:name",
  defineEventHandler(async (event) => {
    const name = getRouterParam(event, "name") as string;
    const payload = {
      ...getQuery(event),
      ...(await readBody(event)
        .then((r) => r?.payload)
        .catch(() => ({}))),
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
    NITRO_NO_UNIX_SOCKET || process.versions.webcontainer
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
  const socketName = `worker-${process.pid}-${threadId}-${Math.round(Math.random() * 10_000)}-${NITRO_DEV_WORKER_ID}.sock`;
  const socketPath = join(NITRO_DEV_WORKER_DIR, socketName);
  switch (process.platform) {
    case "win32": {
      return join(String.raw`\\.\pipe\nitro`, socketPath);
    }
    case "linux": {
      return `\0${socketPath}`;
    }
    default: {
      return socketPath;
    }
  }
}

async function shutdown() {
  server.closeAllConnections?.();
  await Promise.all([
    new Promise((resolve) => listener?.close(resolve)),
    nitroApp.hooks.callHook("close").catch(console.error),
  ]);
  parentPort?.postMessage({ event: "exit" });
}
