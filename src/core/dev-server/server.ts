import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { GetPortInput } from "get-port-please";
import type { FSWatcher } from "chokidar";
import type { App } from "h3";
import type { Listener, ListenOptions } from "listhen";
import { NodeDevWorker, type DevWorker, type WorkerAddress } from "./worker";
import type { Nitro, NitroBuildInfo, NitroDevServer } from "nitropack/types";
import {
  createApp,
  createError,
  eventHandler,
  fromNodeMiddleware,
  toNodeListener,
} from "h3";
import {
  default as defaultErrorHandler,
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

class DevServer {
  nitro: Nitro;
  workerDir: string;
  app: App;
  listeners: Listener[] = [];
  reloadPromise?: Promise<void>;
  lastError?: string;
  watcher?: FSWatcher;
  workers: DevWorker[] = [];

  constructor(nitro: Nitro) {
    this.nitro = nitro;

    this.workerDir = resolve(
      nitro.options.output.dir,
      nitro.options.output.serverDir
    );

    this.app = this.createApp();

    const debouncedReload = debounce(() => this.reload());

    nitro.hooks.hook("close", debouncedReload);
    nitro.hooks.hook("dev:reload", debouncedReload);

    if (nitro.options.devServer.watch.length > 0) {
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
    this.workers.unshift(
      new NodeDevWorker(this.workerDir, {
        onClose: (worker, reason) => {
          this.lastError = reason;
          this.workers = this.workers.filter((w) => w !== worker);
        },
        onReady: (worker, addr) => {
          this.writeBuildInfo(worker, addr);
        },
      })
    );
  }

  async getWorker() {
    for (let retry = 0; retry < 10; retry++) {
      if (this.workers.filter((w) => !w.closed).length === 0) {
        this.reload();
      }
      const activeWorker = this.workers.find((w) => w.ready);
      if (activeWorker) {
        return activeWorker;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
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
          this.nitro.options.devErrorHandler || defaultErrorHandler;
        await loadStackTrace(error).catch(() => {});
        return errorHandler(error, event);
      },
    });

    // Dev-only handlers
    for (const handler of this.nitro.options.devHandlers) {
      app.use(handler.route || "/", handler.handler);
    }

    // Debugging endpoint to view vfs
    app.use("/_vfs", createVFSHandler(this.nitro));

    // Serve asset dirs
    for (const asset of this.nitro.options.publicAssets) {
      const url = joinURL(
        this.nitro.options.runtimeConfig.app.baseURL,
        asset.baseURL || "/"
      );
      app.use(url, fromNodeMiddleware(serveStatic(asset.dir)));
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
          throw createError({
            statusCode: 503,
            message: "No worker available.",
          });
        }
        return worker.handleEvent(event);
      })
    );

    return app;
  }

  async handleUpgrade(
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) {
    const worker = await this.getWorker();
    if (!worker) {
      throw createError({
        statusCode: 503,
        message: "No worker available.",
      });
    }
    return worker.handleUpgrade(req, socket, head);
  }
}
