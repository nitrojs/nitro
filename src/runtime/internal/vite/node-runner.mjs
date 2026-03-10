import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";

// ----- IPC -----

let sendMessage;
const messageListeners = new Set();

// ----- Environment runners -----

const envs = (globalThis.__nitro_vite_envs__ ??= {
  nitro: undefined,
  ssr: undefined,
});

class ViteEnvRunner {
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
          connect({ onMessage }) {
            const listener = (payload) => {
              if (payload?.type === "custom" && payload.viteEnv === name) {
                onMessage(payload);
              }
            };
            messageListeners.add(listener);
          },
          send(payload) {
            sendMessage?.({ ...payload, viteEnv: name });
          },
        },
      },
      new ESModulesEvaluator(),
      process.env.NITRO_DEBUG ? console.debug : undefined
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
    for (let i = 0; i < 5 && !(this.entry || this.entryError); i++) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
    }
    if (this.entryError) {
      return renderError(req, this.entryError);
    }
    if (!this.entry) {
      throw httpError(503, `Vite environment "${this.name}" is unavailable`);
    }
    try {
      const entryFetch = this.entry.fetch || this.entry.default?.fetch;
      if (!entryFetch) {
        throw httpError(500, `No fetch handler exported from ${this.entryPath}`);
      }
      return await entryFetch(req, init);
    } catch (error) {
      return renderError(req, error);
    }
  }
}

// ----- RPC listeners -----

const viteHostRequests = new Map();

async function requestToViteHost(
  name,
  data,
  id = Math.random().toString(16).slice(2),
  timeout = 3000
) {
  setTimeout(() => {
    if (viteHostRequests.has(id)) {
      viteHostRequests.delete(id);
      reject(new Error(`Request to vite host timed out (${name}:${id})`));
    }
  }, timeout);
  let resolve, reject;
  const promise = new Promise((_resolve, _reject) => {
    resolve = (value) => {
      viteHostRequests.delete(id);
      return _resolve(value);
    };
    reject = (err) => {
      viteHostRequests.delete(id);
      return _reject(err);
    };
  });
  viteHostRequests.set(id, { resolve, reject });
  sendMessage?.({
    type: "custom",
    event: "nitro:vite-invoke",
    data: { name, id, data },
  });
  return promise;
}

// Trap unhandled errors to avoid worker crash
process.on("unhandledRejection", (error) => console.error(error));
process.on("uncaughtException", (error) => console.error(error));

// ----- RSC Support -----

// define __VITE_ENVIRONMENT_RUNNER_IMPORT__ for RSC support
// https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/README.md#__vite_environment_runner_import__

globalThis.__VITE_ENVIRONMENT_RUNNER_IMPORT__ = async function (environmentName, id) {
  const env = envs[environmentName];
  if (!env) {
    throw new Error(`Vite environment "${environmentName}" is not registered`);
  }
  return env.runner.import(id);
};

// ----- Reload -----

async function reload() {
  try {
    await Promise.all(Object.values(envs).map((env) => env?.reload()));
  } catch (error) {
    console.error(error);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
reload();

// ----- HTML Transform -----

globalThis.__transform_html__ = async function (html) {
  html = await requestToViteHost("transformHTML", html).catch((error) => {
    console.warn("Failed to transform HTML via Vite:", error);
    return html;
  });
  return html;
};

// ----- Exports (env-runner AppEntry) -----

export function fetch(req) {
  const viteEnv = req?.headers.get("x-vite-env") || "nitro";
  const env = envs[viteEnv];
  if (!env) {
    return renderError(req, httpError(500, `Unknown vite environment "${viteEnv}"`));
  }
  return env.fetch(req);
}

export const ipc = {
  onOpen(ctx) {
    sendMessage = ctx.sendMessage;
  },
  onMessage(message) {
    if (message?.type === "custom") {
      switch (message.event) {
        case "nitro:vite-env": {
          const { name, entry } = message.data;
          if (envs[name]) {
            console.error(`Vite environment "${name}" already registered!`);
          } else {
            envs[name] = new ViteEnvRunner({ name, entry });
          }
          return;
        }
        case "nitro:vite-invoke-response": {
          const { id, data: response } = message.data;
          const req = viteHostRequests.get(id);
          if (req) {
            if (response.error) {
              req.reject(response.error);
            } else {
              req.resolve(response.data);
            }
          }
          return;
        }
      }
    }
    if (message?.type === "full-reload") {
      reload();
      return;
    }
    for (const listener of messageListeners) {
      listener(message);
    }
  },
  onClose() {},
};

// ----- Error handling -----

function httpError(status, message) {
  const error = new Error(message || `HTTP Error ${status}`);
  error.status = status;
  error.name = "NitroViteError";
  return error;
}

async function renderError(req, error) {
  if (req.headers.get("accept")?.includes("application/json")) {
    return new Response(
      JSON.stringify(
        {
          status: error.status || 500,
          name: error.name || "Error",
          message: error.message,
          stack: (error.stack || "")
            .split("\n")
            .splice(1)
            .map((l) => l.trim()),
        },
        null,
        2
      ),
      {
        status: error.status || 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
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
