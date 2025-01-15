import type {
  Nitro,
  NitroBuildInfo,
  NitroDevServer,
  NitroWorker,
} from "nitropack/types";
import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { TLSSocket } from "node:tls";
import { accessSync, existsSync } from "node:fs";
import { writeFile, rm } from "node:fs/promises";
import { resolve, join } from "pathe";
import { Worker } from "node:worker_threads";
import { type FSWatcher, watch } from "chokidar";
import {
  type H3Error,
  type H3Event,
  createApp,
  createError,
  eventHandler,
  fromNodeMiddleware,
  toNodeListener,
} from "h3";
import { type ProxyServerOptions, createProxyServer } from "httpxy";
import { type Listener, listen as listhen } from "listhen";
import { version as nitroVersion } from "nitropack/meta";
import { debounce } from "perfect-debounce";
import { servePlaceholder } from "serve-placeholder";
import serveStatic from "serve-static";
import { joinURL } from "ufo";
import consola from "consola";
import defaultErrorHandler, {
  loadStackTrace,
} from "../../runtime/internal/error/dev";
import { createVFSHandler } from "./vfs";

export function createDevServer(nitro: Nitro): NitroDevServer {
  // Workerdir
  const workerDir = resolve(
    nitro.options.output.dir,
    nitro.options.output.serverDir
  );

  // Error handler
  const errorHandler = nitro.options.devErrorHandler || defaultErrorHandler;

  let lastError: H3Error | undefined;
  let reloadPromise: Promise<void> | undefined;

  let currentWorker: NitroWorker | undefined;

  const reloadWorker = async () => {
    // Kill old worker
    const oldWorker = currentWorker;
    currentWorker = undefined;
    await killWorker(oldWorker, nitro);

    // Create a new worker
    currentWorker = await initWorker(workerDir);
    if (!currentWorker) {
      return;
    }

    // Write {buildDir}/nitro.json
    const buildInfoPath = resolve(nitro.options.buildDir, "nitro.json");
    const buildInfo: NitroBuildInfo = {
      date: new Date().toJSON(),
      preset: nitro.options.preset,
      framework: nitro.options.framework,
      versions: {
        nitro: nitroVersion,
      },
      dev: {
        pid: process.pid,
        workerAddress: currentWorker?.address,
      },
    };
    await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2));
  };

  const reloadWorkerDebounced = debounce(() => {
    reloadPromise = reloadWorker()
      .then(() => {
        lastError = undefined;
      })
      .catch(async (error) => {
        await loadStackTrace(error).catch(() => {});
        consola.error(error);
        lastError = error;
      })
      .finally(() => {
        reloadPromise = undefined;
      });
    return reloadPromise;
  });

  nitro.hooks.hook("dev:reload", reloadWorkerDebounced);

  // App
  const app = createApp();

  // Dev-only handlers
  for (const handler of nitro.options.devHandlers) {
    app.use(handler.route || "/", handler.handler);
  }

  // Debugging endpoint to view vfs
  app.use("/_vfs", createVFSHandler(nitro));

  // Serve asset dirs
  for (const asset of nitro.options.publicAssets) {
    const url = joinURL(
      nitro.options.runtimeConfig.app.baseURL,
      asset.baseURL || "/"
    );
    app.use(url, fromNodeMiddleware(serveStatic(asset.dir)));
    if (!asset.fallthrough) {
      app.use(url, fromNodeMiddleware(servePlaceholder()));
    }
  }

  // User defined dev proxy
  for (const route of Object.keys(nitro.options.devProxy).sort().reverse()) {
    let opts = nitro.options.devProxy[route];
    if (typeof opts === "string") {
      opts = { target: opts };
    }
    const proxy = createProxy(opts);
    app.use(
      route,
      eventHandler(async (event) => {
        await proxy.handle(event);
      })
    );
  }

  // Main worker proxy
  const proxy = createProxy();
  proxy.proxy.on("proxyReq", (proxyReq, req) => {
    if (!proxyReq.hasHeader("x-forwarded-for")) {
      const address = req.socket.remoteAddress;
      if (address) {
        proxyReq.appendHeader("x-forwarded-for", address);
      }
    }
    if (!proxyReq.hasHeader("x-forwarded-port")) {
      const localPort = req?.socket?.localPort;
      if (localPort) {
        proxyReq.setHeader("x-forwarded-port", req.socket.localPort);
      }
    }
    if (!proxyReq.hasHeader("x-forwarded-Proto")) {
      const encrypted = (req?.connection as TLSSocket)?.encrypted;
      proxyReq.setHeader("x-forwarded-proto", encrypted ? "https" : "http");
    }
  });

  const getWorkerAddress = () => {
    const address = currentWorker?.address;
    if (!address) {
      return;
    }
    if (address.socketPath) {
      try {
        accessSync(address.socketPath);
      } catch (error) {
        if (!lastError) {
          lastError = error as typeof lastError;
        }
        return;
      }
    }
    return address;
  };

  // Main handler
  app.use(
    eventHandler(async (event) => {
      await reloadPromise;
      let address = getWorkerAddress();

      // Wait for worker to be ready or error to occur
      for (let i = 0; i < 10 && !address && !lastError; i++) {
        await (reloadPromise ||
          new Promise((resolve) => setTimeout(resolve, 200)));
        address = getWorkerAddress();
      }
      if (!address || lastError) {
        return errorHandler(
          lastError ||
            createError({
              statusCode: 503,
              message: "Worker not ready",
            }),
          event
        );
      }

      await proxy.handle(event, { target: address as any }).catch((error) => {
        lastError = error;
        throw error;
      });
    })
  );

  // WebSocket handler
  const upgrade = (
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) => {
    return proxy.proxy.ws(
      req,
      // @ts-expect-error
      socket,
      {
        target: getWorkerAddress(),
        xfwd: true,
      },
      head
    );
  };

  // Listen
  let listeners: Listener[] = [];
  const listen: NitroDevServer["listen"] = async (port, opts?) => {
    const listener = await listhen(toNodeListener(app), { port, ...opts });
    listener.server.on("upgrade", (req, sock, head) => {
      upgrade(req, sock, head);
    });
    listeners.push(listener);
    return listener;
  };

  // Optional watcher
  let watcher: FSWatcher | undefined;
  if (nitro.options.devServer.watch.length > 0) {
    watcher = watch(nitro.options.devServer.watch, nitro.options.watchOptions);
    watcher
      .on("add", reloadWorkerDebounced)
      .on("change", reloadWorkerDebounced);
  }

  // Close handler
  const close = async () => {
    if (watcher) {
      await watcher.close();
    }
    await killWorker(currentWorker, nitro);
    await Promise.all(listeners.map((l) => l.close()));
    listeners = [];
  };
  nitro.hooks.hook("close", close);

  return {
    reload: reloadWorkerDebounced,
    listen,
    app,
    close,
    watcher,
    upgrade,
  };
}

function initWorker(workerDir: string): Promise<NitroWorker> | undefined {
  const workerEntry = join(workerDir, "index.mjs");

  if (!existsSync(workerEntry)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerEntry, {
      env: {
        ...process.env,
        NITRO_DEV_WORKER_DIR: workerDir,
      },
    });
    worker.once("exit", (code) => {
      reject(
        new Error(
          code ? "[worker] exited with code: " + code : "[worker] exited"
        )
      );
    });
    worker.once("error", async (error) => {
      reject(error);
    });
    const addressListener = (event: any) => {
      if (!event || !event?.address) {
        return;
      }
      worker.off("message", addressListener);
      resolve({
        worker,
        address: event.address,
      } as NitroWorker);
    };
    worker.on("message", addressListener);
  });
}

async function killWorker(worker: NitroWorker | undefined, nitro: Nitro) {
  if (!worker) {
    return;
  }
  if (worker.worker) {
    worker.worker.postMessage({ event: "shutdown" });
    const gracefulShutdownTimeout =
      Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 3;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        nitro.logger.warn(
          `[nitro] [dev] Force closing worker after ${gracefulShutdownTimeout} seconds...`
        );
        resolve();
      }, gracefulShutdownTimeout * 1000);
      worker.worker?.once("message", (message) => {
        if (message.event === "exit") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    worker.worker.removeAllListeners();
    await worker.worker.terminate();
    worker.worker = null;
  }
  if (worker.address.socketPath) {
    await rm(worker.address.socketPath).catch(() => {});
  }
}

function createProxy(defaults: ProxyServerOptions = {}) {
  const proxy = createProxyServer(defaults);
  const handle = async (event: H3Event, opts: ProxyServerOptions = {}) => {
    try {
      await proxy.web(event.node.req, event.node.res, opts);
    } catch (error: any) {
      if (error?.code !== "ECONNRESET") {
        throw error;
      }
    }
  };
  return {
    proxy,
    handle,
  };
}
