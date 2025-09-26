import { parentPort, threadId, workerData } from "node:worker_threads";
import { Agent } from "undici";
import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";
import { getSocketAddress, isSocketSupported } from "get-port-please";

// ----- Environment runners -----

const envs = { nitro: undefined, ssr: undefined };

class EnvRunner {
  constructor({ name, entry }) {
    this.name = name;
    this.entryPath = entry;

    this.entry = undefined;
    this.entryError = undefined;

    // Create Vite Module Runner
    // https://vite.dev/guide/api-environment-runtimes.html#modulerunner
    this.runnerHooks = {};
    this.runner = new ModuleRunner(
      {
        transport: {
          connect({ onMessage, onDisconnection }) {
            parentPort.on("message", (payload) => {
              if (payload?.type === "custom" && payload.viteEnv === name) {
                onMessage(payload);
              }
            });
            parentPort.on("close", onDisconnection);
          },
          send(payload) {
            parentPort.postMessage({ ...payload, viteEnv: name });
          },
        },
      },
      new ESModulesEvaluator(),
      process.env.DEBUG ? console.debug : undefined
    );

    this.reload();
  }

  async reload() {
    try {
      this.entry = await this.runner.import(this.entryPath);
      this.entryError = undefined;
    } catch (error) {
      console.error(error);
      this.entryError = error;
    }
  }

  async fetch(req, init) {
    if (this.entryError) {
      return renderError(req, this.entryError);
    }
    try {
      const entryFetch = this.entry?.fetch || this.entry?.default?.fetch;
      if (!entryFetch) {
        throw httpError(
          500,
          `No fetch handler exported from ${this.entryPath}`
        );
      }
      return await entryFetch(req, init);
    } catch (error) {
      return renderError(req, error);
    }
  }
}

// ----- RPC listeners -----

let viteServerAddr;

parentPort.on("message", (payload) => {
  if (payload?.type !== "custom") {
    return;
  }
  switch (payload.event) {
    case "nitro:vite-server-addr": {
      viteServerAddr = payload.data;
      break;
    }
    case "nitro:vite-env": {
      const { name, entry } = payload.data;
      if (envs[name]) {
        console.error(`Vite environment "${name}" already registered!`);
      } else {
        envs[name] = new EnvRunner({ name, entry });
      }
      break;
    }
  }
});

// ----- Fetch Handler -----

const originalFetch = globalThis.fetch;
globalThis.fetch = function nitroViteFetch(input, init) {
  const viteEnv = init?.viteEnv || input?.headers?.get("x-vite-env") || "nitro";
  if (!viteEnv) {
    return originalFetch(input, init);
  }
  const env = envs[viteEnv];
  if (!env) {
    throw httpError(500, `Unknown vite environment "${viteEnv}"`);
  }

  if (typeof input === "string" && input[0] === "/") {
    input = new URL(input, "http://localhost");
  }
  const headers = new Headers(init.headers || {});
  headers.set("x-vite-env", viteEnv);
  return env.fetch(input, { ...init, viteEnv: undefined, headers });
};

// ----- Server -----

async function reload() {
  try {
    // Apply globals
    for (const [key, value] of Object.entries(workerData.globals || {})) {
      globalThis[key] = value;
    }
    // Reload all envs
    await Promise.all(Object.values(envs).map((env) => env?.reload()));
  } catch (error) {
    console.error(error);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
reload();

if (workerData.server) {
  const { createServer } = await import("node:http");
  const { toNodeHandler } = await import("srvx/node");
  const server = createServer(
    toNodeHandler(async (req, init) => {
      const viteEnv =
        init?.viteEnv || req?.headers.get("x-vite-env") || "nitro"; // TODO
      const env = envs[viteEnv];
      if (!env) {
        return renderError(
          req,
          httpError(500, `Unknown vite environment "${viteEnv}"`)
        );
      }
      return env.fetch(req, init);
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

// ----- Error handling -----

function httpError(status, message) {
  const error = new Error(message || `HTTP Error ${status}`);
  error.status = status;
  error.name = "NitroViteError";
  return error;
}

async function renderError(req, error) {
  const { Youch } = await import("youch");
  const youch = new Youch();
  return new Response(await youch.toHTML(error), {
    status: error.status || 500,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

// ----- Internal Utils -----

async function listen(server) {
  const listenAddr = (await isSocketSupported())
    ? getSocketAddress({
        name: `nitro-vite-${threadId}`,
        pid: true,
        random: true,
      })
    : { port: 0, host: "localhost" };
  return new Promise((resolve, reject) => {
    try {
      server.listen(listenAddr, () => resolve());
    } catch (error) {
      reject(error);
    }
  });
}

function fetchAddress(addr, input, inputInit) {
  let url;
  let init;
  if (input instanceof Request) {
    url = new URL(input.url);
    init = {
      method: input.method,
      headers: input.headers,
      body: input.body,
      ...inputInit,
    };
  } else {
    url = new URL(input);
    init = inputInit;
  }
  init = {
    duplex: "half",
    redirect: "manual",
    ...init,
  };
  if (addr.socketPath) {
    url.protocol = "http:";
    return fetch(url, {
      ...init,
      ...fetchSocketOptions(addr.socketPath),
    });
  }
  const origin = `http://${addr.host}${addr.port ? `:${addr.port}` : ""}`;
  const outURL = new URL(url.pathname + url.search, origin);
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
