import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parentPort, threadId, workerData } from "node:worker_threads";
import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

const runner = new ModuleRunner(
  {
    transport: {
      connect(handlers) {
        const { onMessage, onDisconnection } = handlers;
        parentPort.on("message", onMessage);
        parentPort.on("close", onDisconnection);
      },
      send(payload) {
        parentPort.postMessage(payload);
      },
    },
  },
  new ESModulesEvaluator(),
  process.env.DEBUG ? console.debug : undefined
);

for (const [key, value] of Object.entries(workerData.globals || {})) {
  globalThis[key] = value;
}

const exports = await runner.import(workerData.viteEntry);

// --- auto listhen ---

const fetchHandler = exports?.fetch || exports?.default?.fetch;

if (fetchHandler) {
  await startServer(fetchHandler);
}

async function startServer(fetchHandler) {
  const { toNodeHandler } = await import("srvx/node");
  const server = createServer(toNodeHandler(fetchHandler));
  const listener = await listen(server);
  // TODO: close on exit
}

function listen(server, useRandomPort = false) {
  return new Promise((resolve, reject) => {
    try {
      const listener = server.listen(
        useRandomPort ? 0 : getSocketAddress(),
        () => {
          const address = server.address();
          parentPort?.postMessage({
            event: "listen",
            address:
              typeof address === "string"
                ? { socketPath: address }
                : { host: "localhost", port: address?.port },
          });
          resolve(listener);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

function getSocketAddress() {
  const socketName = `nitro-vite-${process.pid}-${threadId}-${workerData.name}-${Math.round(Math.random() * 10_000)}.sock`;
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
