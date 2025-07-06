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

let entry, entryError;

async function reload() {
  try {
    entry = await runner.import(workerData.viteEntry);
    entryError = undefined;
  } catch (error) {
    entryError = error;
  }
}

await reload();

// ----- Server -----

if (workerData.listen) {
  const { createServer } = await import("node:http");
  const { toNodeHandler } = await import("srvx/node");
  const server = createServer(
    toNodeHandler(async (req, init) => {
      if (entryError) {
        return renderError(req, entryError);
      }
      const fetch = entry?.fetch || entry?.default?.fetch;
      if (!fetch) {
        return new Response(
          `Missing \`fetch\` export in "${workerData.viteEntry}"`,
          { status: 500 }
        );
      }
      try {
        return await fetch(req, init);
      } catch (error) {
        return renderError(req, error);
      }
    })
  );

  parentPort.on("close", () => {
    console.log("Closing server...");
    server.close();
  });

  parentPort.on("message", async (message) => {
    if (message?.type === "full-reload") {
      await reload();
    }
  });
  await listen(server);
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

async function renderError(req, error) {
  const { Youch } = await import("youch");
  const youch = new Youch();
  return new Response(await youch.toHTML(error), {
    status: error.status || 500,
    headers: {
      "Content-Type": "text/html",
    },
  });
}
