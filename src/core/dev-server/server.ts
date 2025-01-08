import { accessSync, existsSync, promises as fsp } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { TLSSocket } from "node:tls";
import { Worker } from "node:worker_threads";
import { type FSWatcher, watch } from "chokidar";
import {
  type H3Error,
  type H3Event,
  createApp,
  createError,
  eventHandler,
  fromNodeMiddleware,
  sendRedirect,
  toNodeListener,
} from "h3";
import { type ProxyServerOptions, createProxyServer } from "httpxy";
import { type Listener, listen } from "listhen";
import { version as nitroVersion } from "nitropack/meta";
import type {
  Nitro,
  NitroBuildInfo,
  NitroDevServer,
  NitroRouteRules,
  NitroWorker,
} from "nitropack/types";
import { resolve } from "pathe";
import { debounce } from "perfect-debounce";
import { servePlaceholder } from "serve-placeholder";
import serveStatic from "serve-static";
import { joinURL } from "ufo";
import defaultErrorHandler from "./error";
import { createVFSHandler } from "./vfs";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import defu from "defu";

function initWorker(filename: string): Promise<NitroWorker> | undefined {
  if (!existsSync(filename)) {
    return;
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(filename);
    worker.once("exit", (code) => {
      reject(
        new Error(
          code ? "[worker] exited with code: " + code : "[worker] exited"
        )
      );
    });
    worker.once("error", (error) => {
      const newError = new Error(`[worker init] ${filename} failed`, {
        cause: error,
      });
      if (Error.captureStackTrace) {
        Error.captureStackTrace(newError, initWorker);
      }
      reject(newError);
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
  if (worker.address.socketPath && existsSync(worker.address.socketPath)) {
    await fsp.rm(worker.address.socketPath).catch(() => {});
  }
}

export function createDevServer(nitro: Nitro): NitroDevServer {
  // Worker
  const workerEntry = resolve(
    nitro.options.output.dir,
    nitro.options.output.serverDir,
    "index.mjs"
  );

  // Error handler
  const errorHandler = nitro.options.devErrorHandler || defaultErrorHandler;

  let lastError: H3Error | undefined;
  let reloadPromise: Promise<void> | undefined;

  let currentWorker: NitroWorker | undefined;
  async function _reload() {
    // Kill old worker
    const oldWorker = currentWorker;
    currentWorker = undefined;
    await killWorker(oldWorker, nitro);
    // Create a new worker
    currentWorker = await initWorker(workerEntry);
    if (!currentWorker) {
      return;
    }
    // Write nitro.json
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
  }
  const reload = debounce(() => {
    reloadPromise = _reload()
      .then(() => {
        lastError = undefined;
      })
      .catch((error) => {
        console.error("[worker reload]", error);
        lastError = error;
      })
      .finally(() => {
        reloadPromise = undefined;
      });
    return reloadPromise;
  });
  nitro.hooks.hook("dev:reload", reload);

  // App
  const app = createApp();

  // Dev-only handlers
  for (const handler of nitro.options.devHandlers) {
    app.use(handler.route || "/", handler.handler);
  }
  // Debugging endpoint to view vfs
  app.use("/_vfs", createVFSHandler(nitro));

  // Apply headers based on routeRules. In cases where the dev server is being
  // used, these would otherwise fail to be applied to public assets.
  const routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: nitro.options.routeRules })
  );
  // Serve asset dirs
  for (const asset of nitro.options.publicAssets) {
    const url = joinURL(
      nitro.options.runtimeConfig.app.baseURL,
      asset.baseURL || "/"
    );
    app.use(
      url,
      fromNodeMiddleware(
        serveStatic(asset.dir, {
          setHeaders: (res) => {
            const path = res.req.url;
            if (path === undefined) {
              return;
            }
            const rules: NitroRouteRules = defu(
              {},
              ...routeRulesMatcher.matchAll(path).reverse()
            );
            if (!rules.headers) {
              return;
            }
            for (const [k, v] of Object.entries(rules.headers)) {
              res.appendHeader(k, v);
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
    // TODO: Use httpxy to set these headers
    if (!proxyReq.hasHeader("x-forwarded-for")) {
      const address = req.socket.remoteAddress;
      // #2197
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

  app.use(
    eventHandler(async (event) => {
      await reloadPromise;
      if (
        nitro.options.baseURL?.length > 1 &&
        !event.path.startsWith(nitro.options.baseURL)
      ) {
        return sendRedirect(
          event,
          joinURL(nitro.options.baseURL, event.path),
          307
        );
      }
      const address = getWorkerAddress();
      if (!address) {
        const error = lastError || createError("Worker not ready");
        return errorHandler(error, event);
      }
      await proxy.handle(event, { target: address as any }).catch((error) => {
        lastError = error;
        throw error;
      });
    })
  );

  // Upgrade handler
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
  const _listen: NitroDevServer["listen"] = async (port, opts?) => {
    const listener = await listen(toNodeListener(app), { port, ...opts });
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
    watcher.on("add", reload).on("change", reload);
  }

  // Close handler
  async function close() {
    if (watcher) {
      await watcher.close();
    }
    await killWorker(currentWorker, nitro);
    await Promise.all(listeners.map((l) => l.close()));
    listeners = [];
  }
  nitro.hooks.hook("close", close);

  return {
    reload,
    listen: _listen,
    app,
    close,
    watcher,
    upgrade,
  };
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
