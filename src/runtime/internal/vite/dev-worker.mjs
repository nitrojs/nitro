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
    this.reloading = undefined;
    this.pendingReload = undefined;

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

  // Reloads run one at a time and everything requested while one is in flight
  // is coalesced into a single re-run, so overlapping re-imports cannot race on
  // `this.entry`. `file` is the changed file whose evaluations have to be
  // dropped; without one, the whole graph is re-evaluated.
  reload(file) {
    const pending = (this.pendingReload ??= { files: new Set(), all: false });
    if (file) {
      pending.files.add(file);
    } else {
      pending.all = true;
    }
    this.reloading ??= (async () => {
      try {
        while (this.pendingReload) {
          const { files, all } = this.pendingReload;
          this.pendingReload = undefined;
          await this.loadEntry(all ? undefined : files);
        }
      } finally {
        this.reloading = undefined;
      }
    })();
    return this.reloading;
  }

  async loadEntry(files) {
    if (this.runner.isClosed()) {
      return;
    }
    try {
      if (files) {
        for (const file of files) {
          this.invalidateFile(file);
        }
      } else {
        // Nothing to scope the reload to (added or removed handlers): drop
        // every evaluation, the same way Vite's own full-reload handler does.
        this.runner.evaluatedModules.clear();
      }
      this.entry = await this.runner.import(this.entryPath);
      this.entryError = undefined;
    } catch (error) {
      console.error(error);
      this.entryError = error;
    }
  }

  // Drops the evaluations of `file` and of everything importing it, so the next
  // import re-evaluates them. Vite already invalidates them on the server, but
  // a plugin that crawls (and re-transforms) a module's dependencies can
  // repopulate their transform result before the runner re-fetches them, and
  // `fetchModule` then answers `{cache: true}` and the stale evaluation is kept.
  // Modules the change cannot affect keep their state (and their singletons).
  invalidateFile(file) {
    const { evaluatedModules } = this.runner;
    const seen = new Set();
    const invalidate = (mod) => {
      if (!mod || seen.has(mod.id)) {
        return;
      }
      seen.add(mod.id);
      for (const importer of mod.importers) {
        invalidate(evaluatedModules.getModuleById(importer));
      }
      evaluatedModules.invalidateModule(mod);
    };
    for (const mod of evaluatedModules.getModulesByFile(file) || []) {
      invalidate(mod);
    }
  }

  // Whether `file` is part of this environment's evaluated module graph.
  hasEvaluated(file) {
    return !!file && !!this.runner.evaluatedModules.getModulesByFile(file)?.size;
  }

  // Errors are intentionally not caught here: like production services,
  // they propagate to the caller (the nitro app's error handler or the
  // env-runner fetch boundary below).
  async fetch(req, init) {
    for (let i = 0; i < 5 && !(this.entry || this.entryError); i++) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
    }
    if (this.entryError) {
      throw this.entryError;
    }
    if (!this.entry) {
      throw httpError(503, `Vite environment "${this.name}" is unavailable`);
    }
    const entryFetch = this.entry.fetch || this.entry.default?.fetch;
    if (!entryFetch) {
      throw httpError(500, `No fetch handler exported from ${this.entryPath}`);
    }
    return entryFetch(req, init);
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

// Reloads the environment the `full-reload` was sent for. Other environments
// are only reloaded when they evaluated the changed file themselves: Vite does
// not always associate a file with the module graph of every environment that
// uses it, so their own `full-reload` can be missing. Payloads without a
// `triggeredBy` are not scoped to a file and reload every environment.
async function reload(payload) {
  try {
    const viteEnv = payload?.viteEnv;
    // Vite sends platform paths, the evaluated modules are keyed by posix ones.
    const triggeredBy = payload?.triggeredBy?.replace(/\\/g, "/");
    const targets = Object.values(envs).filter(
      (env) =>
        env && (!viteEnv || !triggeredBy || env.name === viteEnv || env.hasEvaluated(triggeredBy))
    );
    await Promise.all(targets.map((env) => env.reload(triggeredBy)));
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

export async function fetch(req) {
  const viteEnv = req?.headers.get("x-vite-env") || "nitro";
  const env = envs[viteEnv];
  if (!env) {
    return renderError(req, httpError(500, `Unknown vite environment "${viteEnv}"`));
  }
  try {
    return await env.fetch(req);
  } catch (error) {
    return renderError(req, error);
  }
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
      reload(message);
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
