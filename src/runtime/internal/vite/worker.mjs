import { tmpdir } from "node:os";
import { join } from "node:path";
import { parentPort, threadId, workerData } from "node:worker_threads";
import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";

// Create Vite Module Runner
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

// ----- Fetch Handler -----

let rpcURL;

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const headers = new Headers(init?.headers || {});
  if (headers.has("x-env")) {
    const url = new URL(input, rpcURL);
    return originalFetch(url, init);
  }
  return originalFetch(input, init);
};

parentPort.on("message", (payload) => {
  if (payload.type === "custom" && payload.event === "nitro-rpc") {
    rpcURL = payload.data;
  }
});

// ----- Module Entry -----

let entry, entryError;

async function reload() {
  try {
    // Apply globals
    for (const [key, value] of Object.entries(workerData.globals || {})) {
      globalThis[key] = value;
    }
    // Import the entry module
    entry = await runner.import(workerData.viteEntry);
    entryError = undefined;
  } catch (error) {
    entryError = error;
  }
}

await reload();

// ----- Server -----

if (workerData.server) {
  const { createServer } = await import("node:http");
  const { toNodeHandler } = await import("srvx/node");
  const server = createServer(
    toNodeHandler(async (req, init) => {
      if (entryError) {
        return renderError(req, entryError);
      }
      try {
        const fetch = entry?.fetch || entry?.default?.fetch;
        if (!fetch) {
          throw new Error(
            `Missing \`fetch\` export in "${workerData.viteEntry}"`
          );
        }
        return await fetch(req, init);
      } catch (error) {
        return renderError(req, error);
      }
    })
  );

  parentPort.on("message", async (message) => {
    if (message?.type === "full-reload") {
      await reload();
    }
  });
  await listen(server);
  const address = server.address();
  parentPort?.postMessage({
    event: "listen",
    address:
      typeof address === "string"
        ? { socketPath: address }
        : { host: "localhost", port: address?.port },
  });
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

// ----- Internal Utils -----

function listen(server, useRandomPort = false) {
  return new Promise((resolve, reject) => {
    try {
      server.listen(useRandomPort ? 0 : getSocketAddress(), () => resolve());
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
