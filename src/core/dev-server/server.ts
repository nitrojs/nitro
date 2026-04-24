import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Socket } from "node:net";
import type { GetPortInput } from "get-port-please";
import type { FSWatcher } from "chokidar";
import type { App } from "h3";
import type { Listener, ListenOptions } from "listhen";
import { NodeDevWorker, type DevWorker, type WorkerAddress } from "./worker";
import type {
  Nitro,
  NitroBuildInfo,
  NitroDevServer,
  NitroRouteRules,
} from "nitropack/types";
import {
  createApp,
  createError,
  eventHandler,
  fromNodeMiddleware,
  toNodeListener,
} from "h3";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import defu from "defu";
import devErrorHandler, {
  defaultHandler as devErrorHandlerInternal,
  loadStackTrace,
} from "../../runtime/internal/error/dev";
import { version as nitroVersion } from "nitropack/meta";
import consola from "consola";
import serveStatic from "serve-static";
import { writeFile } from "node:fs/promises";
import { resolve } from "pathe";
import { watch } from "chokidar";
import { listen as listhen } from "listhen";
import { servePlaceholder } from "serve-placeholder";
import { joinURL } from "ufo";
import { createVFSHandler } from "./vfs";
import { debounce } from "perfect-debounce";
import { isTest, isCI } from "std-env";
import { createHTTPProxy } from "./proxy";

export function createDevServer(nitro: Nitro): NitroDevServer {
  const devServer = new DevServer(nitro);
  return {
    reload: () => devServer.reload(),
    listen: (port, opts) => devServer.listen(port, opts),
    close: () => devServer.close(),
    upgrade: (req, socket, head) => devServer.handleUpgrade(req, socket, head),
    get app() {
      return devServer.app;
    },
    get watcher() {
      return devServer.watcher;
    },
  };
}

let workerIdCtr = 0;

class DevServer {
  nitro: Nitro;
  workerDir: string;
  app: App;
  listeners: Listener[] = [];
  reloadPromise?: Promise<void>;
  watcher?: FSWatcher;
  workers: DevWorker[] = [];

  workerError?: unknown;

  building?: boolean = true /* assume initial build will start soon */;
  buildError?: unknown;

  constructor(nitro: Nitro) {
    this.nitro = nitro;

    this.workerDir = resolve(
      nitro.options.output.dir,
      nitro.options.output.serverDir
    );

    this.app = this.createApp();

    nitro.hooks.hook("close", () => this.close());

    nitro.hooks.hook("dev:start", () => {
      this.building = true;
      this.buildError = undefined;
    });

    nitro.hooks.hook("dev:reload", () => {
      this.buildError = undefined;
      this.building = false;
      this.reload();
    });

    nitro.hooks.hook("dev:error", (cause: unknown) => {
      this.buildError = cause;
      this.building = false;
      for (const worker of this.workers) {
        worker.close();
      }
    });

    if (nitro.options.devServer.watch.length > 0) {
      const debouncedReload = debounce(() => this.reload());
      this.watcher = watch(
        nitro.options.devServer.watch,
        nitro.options.watchOptions
      );
      this.watcher.on("add", debouncedReload).on("change", debouncedReload);
    }
  }

  async listen(port: GetPortInput, opts?: Partial<ListenOptions>) {
    const listener = await listhen(toNodeListener(this.app), { port, ...opts });
    this.listeners.push(listener);
    listener.server.on("upgrade", (req, sock, head) =>
      this.handleUpgrade(req, sock, head)
    );
    return listener;
  }

  async close() {
    await Promise.all(
      [
        Promise.all(this.listeners.map((l) => l.close())).then(() => {
          this.listeners = [];
        }),
        Promise.all(this.workers.map((w) => w.close())).then(() => {
          this.workers = [];
        }),
        Promise.resolve(this.watcher?.close()).then(() => {
          this.watcher = undefined;
        }),
      ].map((p) =>
        p.catch((error) => {
          consola.error(error);
        })
      )
    );
  }

  reload() {
    for (const worker of this.workers) {
      worker.close();
    }
    const worker = new NodeDevWorker(++workerIdCtr, this.workerDir, {
      onClose: (worker, cause) => {
        this.workerError = cause;
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }
      },
      onReady: (worker, addr) => {
        this.writeBuildInfo(worker, addr);
      },
    });
    if (!worker.closed) {
      this.workers.unshift(worker);
    }
  }

  async getWorker() {
    let retry = 0;
    const maxRetries = isTest || isCI ? 100 : 10;
    while (this.building || ++retry < maxRetries) {
      if ((this.workers.length === 0 || this.buildError) && !this.building) {
        return;
      }
      const activeWorker = this.workers.find((w) => w.ready);
      if (activeWorker) {
        return activeWorker;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  writeBuildInfo(_worker: DevWorker, addr?: WorkerAddress) {
    const buildInfoPath = resolve(this.nitro.options.buildDir, "nitro.json");
    const buildInfo: NitroBuildInfo = {
      date: new Date().toJSON(),
      preset: this.nitro.options.preset,
      framework: this.nitro.options.framework,
      versions: {
        nitro: nitroVersion,
      },
      dev: {
        pid: process.pid,
        workerAddress: addr,
      },
    };
    writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2)).catch(
      (error) => {
        consola.error(error);
      }
    );
  }

  createApp() {
    // Init h3 app
    const app = createApp({
      onError: async (error, event) => {
        const errorHandler =
          this.nitro.options.devErrorHandler || devErrorHandler;
        await loadStackTrace(error).catch(() => {});
        return errorHandler(error, event, {
          defaultHandler: devErrorHandlerInternal,
        });
      },
    });

    // Dev-only handlers
    for (const handler of this.nitro.options.devHandlers) {
      app.use(handler.route || "/", handler.handler);
    }

    // Debugging endpoint to view vfs
    app.use("/_vfs", createVFSHandler(this.nitro));

    const routeRulesMatcher = toRouteMatcher(
      createRadixRouter({ routes: this.nitro.options.routeRules })
    );

    // Serve asset dirs
    for (const asset of this.nitro.options.publicAssets) {
      const url = joinURL(
        this.nitro.options.runtimeConfig.app.baseURL,
        asset.baseURL || "/"
      );
      app.use(
        url,
        fromNodeMiddleware(
          serveStatic(asset.dir, {
            dotfiles: "allow",
            setHeaders(res, path) {
              // https://github.com/nitrojs/nitro/issues/3379
              if (path.endsWith(".gz")) {
                res.setHeader("Content-Encoding", "gzip");
              }
              const pathname = (res.req as any)?._parsedOriginalUrl
                ?.pathname as string;
              if (pathname) {
                const rules: NitroRouteRules = defu(
                  {},
                  ...routeRulesMatcher.matchAll(pathname).reverse()
                );
                if (rules.headers) {
                  for (const [k, v] of Object.entries(rules.headers)) {
                    // Avoid long caching dev assets
                    if (k === "cache-control") continue;
                    res.appendHeader(k, v);
                  }
                }
              }
            },
          })
        )
      );
      if (!asset.fallthrough) {
        app.use(url, fromNodeMiddleware(servePlaceholder()));
      }
    }

    // User defined dev proxy
    const routes = Object.keys(this.nitro.options.devProxy).sort().reverse();
    for (const route of routes) {
      let opts = this.nitro.options.devProxy[route];
      if (typeof opts === "string") {
        opts = { target: opts };
      }
      const proxy = createHTTPProxy(opts);
      app.use(
        route,
        eventHandler((event) => proxy.handleEvent(event))
      );
    }

    // Main handler
    app.use(
      eventHandler(async (event) => {
        const worker = await this.getWorker();
        if (!worker) {
          return this.#generateError();
        }
        return worker.handleEvent(event);
      })
    );

    return app;
  }

  async handleUpgrade(req: IncomingMessage, socket: Socket, head: any) {
    const worker = await this.getWorker();
    if (!worker) {
      throw createError({
        statusCode: 503,
        message: "No worker available.",
      });
    }
    return worker.handleUpgrade(req, socket, head);
  }

  #generateError() {
    const error: any = this.buildError || this.workerError;
    if (error) {
      try {
        error.unhandled = false;
        let id = error.id || error.path;
        if (id) {
          const cause = (error as { errors?: any[] }).errors?.[0];
          const loc =
            error.location || error.loc || cause?.location || cause?.loc;
          if (loc) {
            id += `:${loc.line}:${loc.column}`;
          }
          error.stack = (error.stack || "").replace(
            /(^\s*at\s+.+)/m,
            `    at ${id}\n$1`
          );
        }
      } catch {
        // ignore
      }
      return createError(error);
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
}
