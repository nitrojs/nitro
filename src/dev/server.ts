import type { FSWatcher } from "chokidar";
import type { ServerOptions, Server } from "srvx";
import type {
  EnvRunnerData,
  RunnerMessageListener,
  RunnerRPCHooks,
  WorkerAddress,
} from "env-runner";
import type { RunnerName } from "env-runner";
import { RunnerManager, loadRunner } from "env-runner";
import type { Nitro } from "nitro/types";

import { HTTPError } from "h3";

import consola from "consola";
import { resolve } from "pathe";
import { watch } from "chokidar";
import { serve } from "srvx";
import { debounce } from "perfect-debounce";
import { isTest, isCI } from "std-env";
import { NitroDevApp } from "./app.ts";
import { writeDevBuildInfo } from "../build/info.ts";
import { createWebSocketProxyPlugin } from "./_ws-proxy.ts";

export function createDevServer(nitro: Nitro): NitroDevServer {
  return new NitroDevServer(nitro);
}

export class NitroDevServer extends NitroDevApp implements RunnerRPCHooks {
  #entry: string;
  #workerData: EnvRunnerData = {};
  #listeners: Server[] = [];
  #watcher?: FSWatcher;
  #manager: RunnerManager;
  #workerIdCtr: number = 0;
  #workerError?: unknown;
  #workerRetries: number = 0;
  #workerAddr?: WorkerAddress;
  #building?: boolean = true; // Assume initial build will start soon
  #buildError?: unknown;
  #reloadPromise?: Promise<void>;

  constructor(nitro: Nitro) {
    super(nitro, async (event) => {
      if (this.#building) {
        await this.#waitForBuild();
      }
      if (this.#reloadPromise) {
        await this.#reloadPromise;
      }
      if (this.#buildError) {
        return this.#generateError();
      }
      const response = await this.#manager.fetch(event.req as Request);
      if (response.status === 503 && !this.#manager.ready) {
        return this.#generateError();
      }
      return response;
    });

    // Bind all methods to `this`
    for (const key of Object.getOwnPropertyNames(NitroDevServer.prototype)) {
      const value = (this as any)[key];
      if (typeof value === "function" && key !== "constructor") {
        (this as any)[key] = value.bind(this);
      }
    }

    // Attach to Nitro.fetch
    nitro.fetch = this.fetch.bind(this);

    this.#entry = resolve(nitro.options.output.dir, nitro.options.output.serverDir, "index.mjs");

    this.#manager = new RunnerManager();
    this.#manager.onReady(async (_runner, addr) => {
      this.#workerRetries = 0;
      this.#workerAddr = addr;
      writeDevBuildInfo(this.nitro, addr).catch((error) => {
        this.nitro.logger.warn(
          `Failed to write dev build info: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    });
    this.#manager.onClose((_runner, cause) => {
      this.#workerError = cause;
      if (this.#workerRetries++ < 3) {
        this.nitro.logger.info("Restarting dev worker...", cause ? `Cause: ${cause}` : "");
        this.reload();
      } else {
        this.nitro.logger.error(
          "Dev worker failed after 3 retries.",
          cause ? `Last cause: ${cause}` : ""
        );
      }
    });

    nitro.hooks.hook("close", () => this.close());

    nitro.hooks.hook("dev:start", () => {
      this.#building = true;
      this.#buildError = undefined;
    });

    nitro.hooks.hook("dev:reload", (payload) => {
      this.#buildError = undefined;
      this.#building = false;
      if (payload?.entry) {
        this.#entry = payload.entry;
      }
      if (payload?.workerData) {
        this.#workerData = payload.workerData;
      }
      this.reload();
    });

    nitro.hooks.hook("dev:error", (cause: unknown) => {
      this.#buildError = cause;
      this.#building = false;
    });

    const devWatch = nitro.options.devServer.watch;
    if (devWatch && devWatch.length > 0) {
      const debouncedReload = debounce(() => this.reload());
      this.#watcher = watch(devWatch, nitro.options.watchOptions);
      this.#watcher.on("add", debouncedReload).on("change", debouncedReload);
    }
  }

  // #region Public Methods

  async listen(opts?: Partial<Omit<ServerOptions, "fetch">>): Promise<Server> {
    // Proxy WebSocket upgrades to the dev worker using `crossws` + a standard
    // `WebSocket` client. This is runtime-native (works under Node, Bun and
    // Deno) and avoids the Node.js `http.Server` `"upgrade"` event + raw socket
    // proxy, which fails under `bun --bun` (Bun drops manual upgrade writes and
    // its `node:http` client never surfaces the `101` response).
    const websocket =
      this.nitro.options.features.websocket ?? this.nitro.options.experimental.websocket;
    const plugins = [...(opts?.plugins ?? [])];
    if (websocket) {
      plugins.push(await createWebSocketProxyPlugin(() => this.#workerAddr));
    }
    const server = serve({
      ...opts,
      fetch: this.fetch,
      plugins,
      gracefulShutdown: false,
    });
    this.#listeners.push(server);
    return server;
  }

  async close() {
    await Promise.all(
      [
        Promise.all(this.#listeners.map((l) => l.close())).then(() => {
          this.#listeners = [];
        }),
        this.#manager.close(),
        Promise.resolve(this.#watcher?.close()).then(() => {
          this.#watcher = undefined;
        }),
      ].map((p) =>
        p.catch((error) => {
          consola.error(error);
        })
      )
    );
  }

  reload() {
    const nextReload = (this.#reloadPromise ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.#reload());
    this.#reloadPromise = nextReload.finally(() => {
      if (this.#reloadPromise === nextReload) {
        this.#reloadPromise = undefined;
      }
    });
  }

  async #reload() {
    const runnerName =
      this.nitro.options.devServer.runner || process.env.NITRO_DEV_RUNNER || "node-worker";
    const runner = await loadRunner(runnerName as RunnerName, {
      name: `Nitro_${this.#workerIdCtr++}`,
      data: { entry: this.#entry, ...this.#workerData },
    });
    await this.#manager.reload(runner);
  }

  sendMessage(message: unknown) {
    this.#manager.sendMessage(message);
  }

  onMessage(listener: RunnerMessageListener) {
    this.#manager.onMessage(listener);
  }

  offMessage(listener: RunnerMessageListener) {
    this.#manager.offMessage(listener);
  }

  // #endregion

  // #region Private Methods

  async #waitForBuild() {
    const timeout = isTest || isCI ? 60_000 : 6000;
    await this.#manager.waitForReady(timeout);
  }

  #generateError() {
    const error: any = this.#buildError || this.#workerError;
    if (error) {
      try {
        error.unhandled = false;
        let id = error.id || error.path;
        if (id) {
          const cause = (error as { errors?: any[] }).errors?.[0];
          const loc = error.location || error.loc || cause?.location || cause?.loc;
          if (loc) {
            id += `:${loc.line}:${loc.column}`;
          }
          error.stack = (error.stack || "").replace(/(^\s*at\s+.+)/m, `    at ${id}\n$1`);
        }
      } catch {
        // ignore
      }
      return new HTTPError(error);
    }

    return new Response(
      JSON.stringify(
        {
          error: "Dev server is unavailable.",
          hint: "Please reload the page and check the console for errors if the issue persists.",
        },
        null,
        2
      ),
      {
        status: 503,
        statusText: "Dev server is unavailable",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Refresh: "3",
        },
      }
    );
  }

  // #endregion
}
