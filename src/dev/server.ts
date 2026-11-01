import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import type { FSWatcher } from "chokidar";
import type { ServerOptions, Server } from "srvx";
import type { Hooks } from "crossws";
import type { ProxyAddr } from "httpxy";
import type {
  EnvRunner,
  EnvRunnerData,
  EnvRunnerPluginOption,
  RunnerMessageListener,
  RunnerRPCHooks,
} from "env-runner";
import type { RunnerName } from "env-runner";
import { RunnerManager, loadRunner } from "env-runner";
import type { Nitro, WorkerAddress } from "nitro/types";

import { HTTPError } from "h3";

import consola from "consola";
import { readFile } from "node:fs/promises";
import { resolve } from "pathe";
import { serve } from "srvx";
import { debounce } from "perfect-debounce";
import { isTest, isCI } from "std-env";
import { NitroDevApp } from "./app.ts";
import { withDevErrorRecovery } from "./_error-recovery.ts";
import { createWatcher } from "../utils/watch.ts";
import { resolveRunnerDeps } from "./runner-deps.ts";
import { shutdownRunner } from "./shutdown.ts";
import { handleDevRPC } from "./_rpc.ts";
import { createWorkerWebSocketProxy } from "./_proxy.ts";
import { webSocketPlugin } from "./_ws.ts";
import { writeDevBuildInfo } from "../build/info.ts";

export interface NitroDevServer {
  fetch: (req: Request) => Response | Promise<Response>;
  upgrade: (req: IncomingMessage, socket: Socket, head: any) => Promise<void>;
  listen: (opts?: Partial<Omit<ServerOptions, "fetch">>) => Server;
  reload: () => void;
  close: () => Promise<void>;
}

export function createDevServer(nitro: Nitro): NitroDevServer {
  return new DevServer(nitro);
}

class DevServer extends NitroDevApp implements NitroDevServer, RunnerRPCHooks {
  #entry: string;
  #workerData: EnvRunnerData = {};
  #plugins?: EnvRunnerPluginOption[];
  #listeners: Server[] = [];
  #devInfo: { workerAddress?: WorkerAddress; url?: string } = {};
  #devInfoWrite: Promise<void> = Promise.resolve();
  #watcher?: FSWatcher;
  #manager: RunnerManager;
  #workerWebSocket: () => Promise<Partial<Hooks>>;
  #workerIdCtr: number = 0;
  #runnerName?: RunnerName;
  #workerError?: unknown;
  #workerRetries: number = 0;
  #building?: boolean = true; // Assume initial build will start soon
  #buildError?: unknown;
  #reloadPromise?: Promise<void>;
  #shuttingDown: boolean = false;
  #closing: boolean = false;

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
    for (const key of Object.getOwnPropertyNames(DevServer.prototype)) {
      const value = (this as any)[key];
      if (typeof value === "function" && key !== "constructor") {
        (this as any)[key] = value.bind(this);
      }
    }

    // Open dev error pages wait for the next reload
    const appFetch = this.fetch;
    this.fetch = async (req) =>
      withDevErrorRecovery(req, await appFetch(req), {
        signal: this.reloadSignal,
        base: nitro.options.baseURL,
      });

    // Attach to Nitro.fetch
    nitro.fetch = this.fetch.bind(this);

    this.#entry = resolve(nitro.options.output.dir, nitro.options.output.serverDir, "index.mjs");

    this.#manager = new RunnerManager();
    this.#workerWebSocket = createWorkerWebSocketProxy(
      async () => {
        if (this.#building) {
          await this.#waitForBuild();
        }
        if (this.#reloadPromise) {
          await this.#reloadPromise;
        }
        if (!this.#manager.ready) {
          await this.#waitForBuild();
        }
        return this.#manager.address;
      },
      // Bun/Deno bridged WebSockets keep a drained worker until they close
      { track: (addr) => trackRunnerExchange(this.#manager, addr) }
    );
    this.#manager.onReady(async (_runner, addr) => {
      this.#workerRetries = 0;
      this.#devInfo.workerAddress = addr;
      this.#writeDevInfo();
    });
    this.#manager.onClose((_runner, cause) => {
      if (this.#shuttingDown) {
        return;
      }
      this.#workerError = cause;
      if (this.#workerRetries++ < 3) {
        this.nitro.logger.info("Restarting dev worker...", cause ? `Cause: ${cause}` : "");
        // Open error pages are not reloaded, since the worker may crash again on each request
        this.#queueReload();
      } else {
        this.nitro.logger.error(
          "Dev worker failed after 3 retries.",
          cause ? `Last cause: ${cause}` : ""
        );
      }
    });

    // Worker => Host RPC
    this.#manager.onMessage((message) =>
      handleDevRPC(message, {
        sendMessage: (message) => this.#manager.sendMessage(message),
        handlers: {
          rendererTemplate: () => readFile(nitro.options.renderer!.template!, "utf8"),
        },
      })
    );

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
      if (payload?.plugins) {
        this.#plugins = payload.plugins;
      }
      this.reload();
    });

    nitro.hooks.hook("dev:error", (cause: unknown) => {
      this.#buildError = cause;
      this.#building = false;
      this.reloadSignal.bump();
    });

    const devWatch = nitro.options.devServer.watch;
    if (devWatch && devWatch.length > 0) {
      const debouncedReload = debounce(() => this.reload());
      this.#watcher = createWatcher(nitro, devWatch, nitro.options.watchOptions);
      this.#watcher.on("add", debouncedReload).on("change", debouncedReload);
    }
  }

  // #region Public Methods

  async upgrade(req: IncomingMessage, socket: Socket, head: any) {
    if (this.proxyUpgrade(req, socket, head)) {
      return;
    }
    if (!this.#manager.upgrade) {
      throw new HTTPError({
        status: 501,
        statusText: "Worker does not support upgrades.",
      });
    }
    return this.#manager.upgrade({ node: { req, socket, head } });
  }

  /**
   * Runtime-agnostic alternative to {@link upgrade}: resolve `crossws` hooks proxying a WebSocket
   * upgrade request to a matching `devProxy` rule or to the dev worker.
   */
  resolveWebSocketHooks(req: Request): Promise<Partial<Hooks>> {
    return this.resolveWebSocketProxy(req) || this.#workerWebSocket();
  }

  listen(opts?: Partial<Omit<ServerOptions, "fetch">>): Server {
    const server = serve({
      ...opts,
      fetch: this.fetch,
      gracefulShutdown: false,
      plugins: [...(opts?.plugins || []), webSocketPlugin(this.resolveWebSocketHooks)],
    });
    this.#listeners.push(server);
    server.ready().then(
      () => {
        if (!this.#devInfo.url && server.url) {
          this.#devInfo.url = server.url;
          this.#writeDevInfo();
        }
      },
      () => {}
    );
    if (server.node?.server) {
      server.node.server.on("upgrade", (req, sock, head) => this.upgrade(req, sock, head));
    }
    return server;
  }

  async close() {
    this.#closing = true;
    this.reloadSignal.close();
    await this.#reloadPromise?.catch(() => {});
    // With drain, the manager shuts the active and draining workers down gracefully
    const drain = this.nitro.options.devServer.drain;
    if (!drain) {
      await this.#shutdownWorker();
    }
    await Promise.all(
      [
        Promise.all(this.#listeners.map((l) => l.close())).then(() => {
          this.#listeners = [];
        }),
        drain ? this.#manager.shutdown() : this.#manager.close(),
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
    this.#queueReload()
      ?.catch(() => {})
      .finally(() => this.reloadSignal.bump());
  }

  #queueReload(): Promise<void> | undefined {
    if (this.#closing) {
      return;
    }
    const nextReload = (this.#reloadPromise ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.#reload());
    this.#reloadPromise = nextReload.finally(() => {
      if (this.#reloadPromise === nextReload) {
        this.#reloadPromise = undefined;
      }
    });
    return nextReload;
  }

  async #reload() {
    const drain = this.nitro.options.devServer.drain;
    // A drained worker is shut down by the manager once its requests settle
    if (!drain) {
      await this.#shutdownWorker();
    }
    const runnerName = (this.nitro.options.devServer.runner ||
      process.env.NITRO_DEV_RUNNER ||
      "node-worker") as RunnerName;
    this.#runnerName = runnerName;
    const runner = await loadRunner(runnerName, {
      ...(await resolveRunnerDeps(this.nitro, runnerName)),
      name: `Nitro_${this.#workerIdCtr++}`,
      data: { entry: this.#entry, ...this.#workerData },
      plugins: this.#plugins,
    });
    await this.#manager.reload(runner, { drain });
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

  async #shutdownWorker() {
    // The miniflare runner runs the same handshake itself when it is disposed
    if (!this.#manager.ready || this.#runnerName === "miniflare") {
      return;
    }
    this.#shuttingDown = true;
    try {
      await shutdownRunner(this.#manager, { warn: (message) => this.nitro.logger.warn(message) });
    } finally {
      this.#shuttingDown = false;
    }
  }

  /** Point CLI commands (`nitro task`, `nitro fetch`) to this dev server. */
  #writeDevInfo() {
    // One write at a time, so that an earlier one does not finish last
    this.#devInfoWrite = this.#devInfoWrite
      .then(() => writeDevBuildInfo(this.nitro, this.#devInfo))
      .catch((error) => {
        this.nitro.logger.warn(
          `Failed to write dev build info: ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }

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

/**
 * Count a WebSocket as an exchange of the active runner, like `RunnerManager.wsSrvxPlugin()`
 * does, whose tracking isn't exposed otherwise.
 */
function trackRunnerExchange(manager: RunnerManager, addr: ProxyAddr) {
  const internal = manager as unknown as {
    _runner?: EnvRunner;
    _beginExchange?: (runner: EnvRunner) => () => void;
  };
  if (typeof internal._beginExchange !== "function") {
    return;
  }
  const runner = internal._runner;
  if (!runner || runner.address !== addr) {
    throw new Error("The dev worker changed before the WebSocket connected");
  }
  return internal._beginExchange(runner);
}
