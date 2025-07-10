import { tmpdir } from "node:os";
import { join } from "node:path";
import { parentPort, threadId, workerData } from "node:worker_threads";
import { Agent } from "undici";
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

let rpcAddr;

const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const { viteEnv } = init || {};
  if (!viteEnv) {
    return originalFetch(input, init);
  }
  if (typeof input === "string" && input[0] === "/") {
    input = new URL(input, "http://localhost");
  }
  const headers = new Headers(init?.headers || {});
  headers.set("x-vite-env", viteEnv);
  return fetchAddress(input, { ...init, viteEnv: undefined, headers }, rpcAddr);
};

parentPort.on("message", (payload) => {
  if (payload.type === "custom" && payload.event === "nitro-rpc") {
    rpcAddr = payload.data;
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

function fetchAddress(input, init, addr) {
  if (addr.socketPath) {
    return fetch(input, {
      ...init,
      ...fetchSocketOptions(addr.socketPath),
    });
  }
  const reqURL = new URL(input);
  const outURL = new URL(
    reqURL.pathname + reqURL.search,
    `http://${addr.host}${addr.port ? `:${addr.port}` : ""}`
  );
  return fetch(outURL, init);
}

function fetchSocketOptions(socketPath) {
  if ("Bun" in globalThis) {
    // https://bun.sh/guides/http/fetch-unix
    return { unix: socketPath };
  }
  if ("Deno" in globalThis) {
    // https://github.com/denoland/deno/pull/29154
    return {
      client: Deno.createHttpClient({
        // @ts-expect-error Missing types?
        transport: "unix",
        path: socketPath,
      }),
    };
  }
  // https://github.com/nodejs/undici/issues/2970
  return {
    dispatcher: new Agent({ connect: { socketPath } }),
  };
}
