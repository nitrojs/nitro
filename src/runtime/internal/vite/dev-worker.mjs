import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";
import { createViteTransport } from "env-runner/vite";

// Custom evaluator for workerd where `new AsyncFunction()` is disallowed.
// Uses the unsafeEvalBinding exposed by the env-runner miniflare wrapper.
class WorkerdModuleEvaluator {
  startOffset = 0;

  async runInlinedModule(context, code) {
    const unsafeEval = globalThis.__ENV_RUNNER_UNSAFE_EVAL__;
    const keys = Object.keys(context);
    const fn = unsafeEval.newAsyncFunction('"use strict";' + code, "runInlinedModule", ...keys);
    await fn(...keys.map((k) => context[k]));
    Object.seal(context[Object.keys(context)[0]]);
  }

  runExternalModule(filepath) {
    return import(filepath);
  }
}

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
    const onMessage = (listener) => messageListeners.add(listener);
    const transport = createViteTransport((data) => sendMessage?.(data), onMessage, name);
    const evaluator = globalThis.__ENV_RUNNER_UNSAFE_EVAL__
      ? new WorkerdModuleEvaluator()
      : new ESModulesEvaluator();
    const debug =
      typeof process !== "undefined" && process.env?.NITRO_DEBUG ? console.debug : undefined;
    this.runner = new ModuleRunner({ transport }, evaluator, debug);

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

// ----- RPC -----

const rpcRequests = new Map();

function rpc(name, data, timeout = 3000) {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rpcRequests.delete(id);
      reject(new Error(`RPC "${name}" timed out`));
    }, timeout);
    rpcRequests.set(id, { resolve, reject, timer });
    sendMessage?.({ __rpc: name, __rpc_id: id, data });
  });
}

// Trap unhandled errors to avoid worker crash
if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("unhandledRejection", (error) => console.error(error));
  process.on("uncaughtException", (error) => console.error(error));
}

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
  html = await rpc("transformHTML", html).catch((error) => {
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

export function upgrade(context) {
  const handleUpgrade = envs.nitro?.entry?.handleUpgrade;
  if (handleUpgrade) {
    handleUpgrade(context.node.req, context.node.socket, context.node.head);
  }
}

export const ipc = {
  onOpen(ctx) {
    sendMessage = ctx.sendMessage;
  },
  onMessage(message) {
    if (message?.__rpc_id) {
      const req = rpcRequests.get(message.__rpc_id);
      if (req) {
        clearTimeout(req.timer);
        rpcRequests.delete(message.__rpc_id);
        if (message.error) {
          req.reject(typeof message.error === "string" ? new Error(message.error) : message.error);
        } else {
          req.resolve(message.data);
        }
      }
      return;
    }
    if (message?.type === "custom") {
      if (message.event === "nitro:vite-env") {
        const { name, entry } = message.data;
        if (!envs[name]) {
          envs[name] = new ViteEnvRunner({ name, entry });
        }
        return;
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
  try {
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
  } catch {
    return new Response(`<pre>${error.stack || error.message || error}</pre>`, {
      status: error.status || 500,
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }
}
