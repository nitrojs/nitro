import type { NitroPluginContext } from "./types.ts";
import type { DevEnvironmentContext, HotChannel, ResolvedConfig, ViteDevServer } from "vite";

import { IncomingMessage, ServerResponse } from "node:http";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { DevEnvironment } from "vite";
import { watch as chokidarWatch } from "chokidar";
import { watch as fsWatch } from "node:fs";
import { join } from "pathe";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../scan.ts";
import { getEnvRunner } from "./env.ts";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

// ---- Types ----

export type FetchHandler = (req: Request) => Promise<Response>;

export interface TransportHooks {
  sendMessage: (data: any) => void;
  onMessage: (listener: (value: any) => void) => void;
  offMessage: (listener: (value: any) => void) => void;
}

export interface DevServer extends TransportHooks {
  fetch: FetchHandler;
  init?: () => void | Promise<void>;
}

// ---- Fetchable Dev Environment ----

export function createFetchableDevEnvironment(
  name: string,
  config: ResolvedConfig,
  devServer: DevServer,
  entry: string
): FetchableDevEnvironment {
  const transport = createTransport(name, devServer);
  const context: DevEnvironmentContext = { hot: true, transport };
  return new FetchableDevEnvironment(name, config, context, devServer, entry);
}

export class FetchableDevEnvironment extends DevEnvironment {
  devServer: DevServer;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    devServer: DevServer,
    entry: string
  ) {
    super(name, config, context);
    this.devServer = devServer;

    this.devServer.sendMessage({
      type: "custom",
      event: "nitro:vite-env",
      data: { name, entry },
    });
  }

  async dispatchFetch(request: Request): Promise<Response> {
    return this.devServer.fetch(request);
  }

  override async init(...args: any[]): Promise<void> {
    await this.devServer.init?.();
    return super.init(...args);
  }
}

function createTransport(name: string, hooks: TransportHooks): HotChannel {
  const listeners = new WeakMap();
  return {
    send: (data) => hooks.sendMessage({ ...data, viteEnv: name }),
    on: (event: string, handler: any) => {
      if (event === "connection") return;
      const listener = (value: any) => {
        if (value?.type === "custom" && value.event === event && value.viteEnv === name) {
          handler(value.data, {
            send: (payload: any) => hooks.sendMessage({ ...payload, viteEnv: name }),
          });
        }
      };
      listeners.set(handler, listener);
      hooks.onMessage(listener);
    },
    off: (event, handler) => {
      if (event === "connection") return;
      const listener = listeners.get(handler);
      if (listener) {
        hooks.offMessage(listener);
        listeners.delete(handler);
      }
    },
  };
}

// ---- Vite Dev Server Integration ----

export async function configureViteDevServer(ctx: NitroPluginContext, server: ViteDevServer) {
  const nitro = ctx.nitro!;
  const nitroEnv = server.environments.nitro as FetchableDevEnvironment;

  // Restart with nitro.config changes
  const nitroConfigFile = nitro.options._c12.configFile;
  if (nitroConfigFile) {
    server.config.configFileDependencies.push(nitroConfigFile);
  }

  // Websocket
  if (nitro.options.features.websocket ?? nitro.options.experimental.websocket) {
    server.httpServer!.on("upgrade", (req, socket, head) => {
      if (req.url?.startsWith("/?token")) {
        // Vite upgrade. TODO: Is there a better way?
        return;
      }
      getEnvRunner(ctx).upgrade?.(req, socket, head);
    });
  }

  // Rebuild on scan dir changes
  const reload = debounce(async () => {
    await scanHandlers(nitro);
    nitro.routing.sync();
    nitroEnv.moduleGraph.invalidateAll();
    nitroEnv.hot.send({ type: "full-reload" });
  });

  const scanDirs = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, nitro.options.apiDir || "api"),
    join(dir, nitro.options.routesDir || "routes"),
    join(dir, "middleware"),
    join(dir, "plugins"),
    join(dir, "modules"),
  ]);

  const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);
  const scanDirsWatcher = chokidarWatch(scanDirs, {
    ignoreInitial: true,
  }).on("all", (event, path, stat) => {
    if (watchReloadEvents.has(event)) {
      reload();
    }
  });

  const rootDirWatcher = fsWatch(
    nitro.options.rootDir,
    { persistent: false },
    (_event, filename) => {
      if (filename && /^server\.[mc]?[jt]sx?$/.test(filename)) {
        reload();
      }
    }
  );
  nitro.hooks.hook("close", () => {
    scanDirsWatcher.close();
    rootDirWatcher.close();
  });

  // Worker => Host IPC
  const hostIPC = {
    async transformHTML(html: string) {
      return server
        .transformIndexHtml("/", html)
        .then((r) =>
          r.replace(
            "<!--ssr-outlet-->",
            `{{{ globalThis.__nitro_vite_envs__?.["ssr"]?.fetch($REQUEST) || "" }}}`
          )
        );
    },
  };
  nitroEnv.devServer.onMessage(async (payload) => {
    if (payload.type === "custom" && payload.event === "nitro:vite-invoke") {
      const methodName = payload.data.name as keyof typeof hostIPC;
      const res = await hostIPC[methodName](payload.data.data)
        .then((data) => ({ data }))
        .catch((error) => ({ error }));
      nitroEnv.devServer.sendMessage({
        type: "custom",
        event: "nitro:vite-invoke-response",
        data: { id: payload.data.id, data: res },
      });
    }
  });

  const nitroDevMiddleware = async (
    nodeReq: IncomingMessage & { _nitroHandled?: boolean },
    nodeRes: ServerResponse,
    next: (error?: unknown) => void
  ) => {
    // Skip for vite internal requests or if already handled
    if (
      !nodeReq.url ||
      /^\/@(?:vite|fs|id)\//.test(nodeReq.url) ||
      nodeReq._nitroHandled ||
      server.middlewares.stack
        .map((mw) => mw.route)
        .some((base) => base && nodeReq.url!.startsWith(base))
    ) {
      return next();
    }
    nodeReq._nitroHandled = true;
    try {
      // Create web API compat request
      const req = new NodeRequest({ req: nodeReq, res: nodeRes });

      // Try dev app
      const devAppRes = await ctx.devApp!.fetch(req);
      if (nodeRes.writableEnded || nodeRes.headersSent) {
        return;
      }
      if (devAppRes.status !== 404) {
        return await sendNodeResponse(nodeRes, devAppRes);
      }

      // Dispatch the request to the nitro environment
      const envRes = await nitroEnv.dispatchFetch(req);
      if (nodeRes.writableEnded || nodeRes.headersSent) {
        return;
      }
      if (envRes.status === 404) {
        // Allow Vite to try
        nodeReq._nitroHandled = false;
        return next();
      }
      return await sendNodeResponse(nodeRes, envRes);
    } catch (error) {
      return next(error);
    }
  };

  // Handle server routes first to avoid conflicts with static assets served by Vite from the root
  // https://github.com/vitejs/vite/pull/20866
  server.middlewares.use(function nitroDevMiddlewarePre(req, res, next) {
    const fetchDest = req.headers["sec-fetch-dest"];
    res.setHeader("vary", "sec-fetch-dest");
    if (
      // Originating from browser tab or no fetch dest (curl, fetch, etc) and (not script, style, image, etc)
      (!fetchDest || /^(document|iframe|frame|empty)$/.test(fetchDest)) &&
      // Special prefixes (/__vue-router/auto-routes, /@vite-plugin-layouts/, etc)
      !/^\/(?:__|@)/.test(req.url!)
    ) {
      nitroDevMiddleware(req, res, next);
    } else {
      next();
    }
  });

  return () => {
    server.middlewares.use(nitroDevMiddleware);
  };
}
