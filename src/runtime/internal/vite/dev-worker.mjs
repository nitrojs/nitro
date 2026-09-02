import { createViteTransport } from "env-runner/vite";

// `vite` is an optional dependency Nitro resolves from the app, so the module runner cannot be
// imported from here. The generated entry injects it instead (see `build/vite/_dev-worker.ts`).
let ModuleRunner, ESModulesEvaluator;

export function setModuleRunner(moduleRunner) {
  ({ ModuleRunner, ESModulesEvaluator } = moduleRunner);
}

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

// Backstop for a wedged reload: requests fall back to the previous entry (or a
// 503) instead of hanging forever. Not a latency budget — normal reloads never
// come close to it.
const RELOAD_WAIT_TIMEOUT = 30_000;

class ViteEnvRunner {
  constructor({ name, entry }) {
    this.name = name;
    this.entryPath = entry;

    this.entry = undefined;
    this.entryError = undefined;

    // Files whose evaluations the next reload has to drop, collected while a
    // reload is in flight. `all` re-evaluates the whole graph.
    this.pendingReload = undefined;

    // Reloads are serialized so the newest import is always the last one to
    // apply its entry (and its side effects). `reloadPromise` is the tail of
    // the chain and never rejects: failures are captured into `entryError`.
    this.reloadPromise = Promise.resolve();

    // At most one reload waits behind the in-flight one. Further reload
    // requests arriving in that window coalesce into it, so a burst of
    // `full-reload` messages costs one extra import, not one per message.
    this.queuedReload = undefined;

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

  // Reloads are scoped to the changed file when one is known: `file` and its
  // importers are dropped so the re-import re-evaluates them, and everything
  // else keeps its evaluation (and its module state). Requests arriving while
  // a reload is in flight coalesce into the queued one, which then handles
  // every file collected meanwhile.
  reload(file) {
    const pending = (this.pendingReload ??= { files: new Set(), all: false });
    if (file) {
      pending.files.add(file);
    } else {
      pending.all = true;
    }
    if (this.queuedReload) {
      return this.queuedReload;
    }
    const queuedReload = this.reloadPromise.then(async () => {
      this.queuedReload = undefined;
      const { files, all } = this.pendingReload;
      this.pendingReload = undefined;
      if (this.runner.isClosed()) {
        return;
      }
      try {
        if (all) {
          // Nothing to scope the reload to (added or removed handlers): drop
          // every evaluation, the same way Vite's own full-reload handler does.
          this.runner.evaluatedModules.clear();
        } else {
          for (const file of files) {
            this.invalidateFile(file);
          }
        }
        this.entry = await this.runner.import(this.entryPath);
        this.entryError = undefined;
      } catch (error) {
        console.error(error);
        this.entryError = error;
      }
    });
    this.queuedReload = queuedReload;
    this.reloadPromise = queuedReload;
    return queuedReload;
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
    // Wait until nothing is queued or in flight so requests never hit an entry
    // that is about to be replaced.
    const deadline = Date.now() + RELOAD_WAIT_TIMEOUT;
    let reloadPromise;
    while (reloadPromise !== this.reloadPromise) {
      reloadPromise = this.reloadPromise;
      if (await withTimeout(reloadPromise, deadline - Date.now())) {
        console.warn(
          `Vite environment "${this.name}" did not finish reloading within ${RELOAD_WAIT_TIMEOUT}ms.`
        );
        break;
      }
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
// uses it, so their own `full-reload` can be missing.
async function reload(payload) {
  try {
    const viteEnv = payload?.viteEnv;
    // Vite sends platform paths, the evaluated modules are keyed by posix ones.
    const triggeredBy = payload?.triggeredBy?.replace(/\\/g, "/");
    const targets = Object.values(envs).filter(
      (env) => env && (!viteEnv || env.name === viteEnv || env.hasEvaluated(triggeredBy))
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

export async function fetch(req, env, ctx) {
  if (env) {
    // only workerd-based runners (miniflare) invoke the entry as `fetch(request, env, ctx)`
    augmentReq(req, env, ctx);
  }
  const viteEnvName = req?.headers.get("x-vite-env") || "nitro";
  const viteEnv = envs[viteEnvName];
  if (!viteEnv) {
    return renderError(req, httpError(500, `Unknown vite environment "${viteEnvName}"`));
  }
  try {
    return await viteEnv.fetch(req);
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

// ----- Worker bindings -----

function augmentReq(req, env, context) {
  globalThis.__env__ = env;
  req.ip = req.headers.get("cf-connecting-ip") || undefined;
  req.runtime ??= { name: "cloudflare" };
  req.runtime.cloudflare = { ...req.runtime.cloudflare, env, context };
  req.waitUntil = context?.waitUntil?.bind(context);
}

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

// ----- Utils -----

// Resolves `false` when `promise` settles first, `true` when it times out.
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise.then(() => false),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(true), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
