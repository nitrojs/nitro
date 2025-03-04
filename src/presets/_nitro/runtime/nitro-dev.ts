import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import { runTask } from "nitropack/runtime";
import { trapUnhandledNodeErrors } from "nitropack/runtime/internal";
import { startScheduleRunner } from "nitropack/runtime/internal";
import { scheduledTasks, tasks } from "#nitro-internal-virtual/tasks";
import { Server } from "node:http";
import { join } from "node:path";
import { digest } from "ohash";
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
  NITRO_DEV_WORKER_DIR = "",
  NITRO_DEV_WORKER_ID,
} = process.env;

const nitroApp = useNitroApp();

const server = new Server(toNodeListener(nitroApp.h3App));

// https://crossws.unjs.io/adapters/node
if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter(nitroApp.h3App.websocket);
  server.on("upgrade", handleUpgrade);
}

function getAddress() {
  if (NITRO_NO_UNIX_SOCKET || process.versions.webcontainer) {
    return 0;
  }

  const socketName = `worker-${process.pid}-${threadId}-${NITRO_DEV_WORKER_ID}.sock`;
  const socketPath = join(NITRO_DEV_WORKER_DIR || ".", socketName);

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

const listenAddress = getAddress();
const listener = server.listen(listenAddress, () => {
  const _address = server.address();
  parentPort?.postMessage({
    event: "listen",
    address:
      typeof _address === "string"
        ? { socketPath: _address }
        : { host: "localhost", port: _address?.port },
  });
});

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

// Trap unhandled errors
trapUnhandledNodeErrors();

// Graceful shutdown
async function onShutdown(signal?: NodeJS.Signals) {
  await nitroApp.hooks.callHook("close");
}
parentPort?.on("message", async (msg) => {
  if (msg && msg.event === "shutdown") {
    await onShutdown();
    parentPort?.postMessage({ event: "exit" });
  }
});

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
