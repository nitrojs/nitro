import type { NitroPluginContext } from "./types.ts";
import type { DevEnvironmentContext, ResolvedConfig, ViteDevServer } from "vite";
import type { FetchFunctionOptions, FetchResult } from "vite/module-runner";
import type { RunnerRPCHooks } from "env-runner";

import { IncomingMessage, ServerResponse } from "node:http";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { DevEnvironment } from "vite";
import { createViteHotChannel } from "env-runner/vite";
import { watch as chokidarWatch } from "chokidar";
import { watch as fsWatch } from "node:fs";
import { join } from "pathe";
import { debounce } from "perfect-debounce";
import { withBase } from "ufo";
import { scanHandlers } from "../../scan.ts";
import { getEnvRunner } from "./env.ts";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

// ---- Types ----

export type FetchHandler = (req: Request) => Promise<Response>;

export interface DevServer extends RunnerRPCHooks {
  fetch: FetchHandler;
  init?: () => void | Promise<void>;
}

// ---- Fetchable Dev Environment ----

export function createFetchableDevEnvironment(
  name: string,
  config: ResolvedConfig,
  devServer: DevServer,
  entry: string,
  opts?: { preventExternalize?: boolean }
): FetchableDevEnvironment {
  const transport = createViteHotChannel(devServer, name);
  const context: DevEnvironmentContext = { hot: true, transport };
  return new FetchableDevEnvironment(name, config, context, devServer, entry, opts);
}

export class FetchableDevEnvironment extends DevEnvironment {
  devServer: DevServer;

  #entry: string;
  #preventExternalize: boolean;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    devServer: DevServer,
    entry: string,
    opts?: { preventExternalize?: boolean }
  ) {
    super(name, config, context);
    this.devServer = devServer;
    this.#entry = entry;
    this.#preventExternalize = opts?.preventExternalize ?? false;
  }

  override async fetchModule(
    id: string,
    importer?: string,
    options?: FetchFunctionOptions
  ): Promise<FetchResult> {
    // workerd cannot handle CJS/Node modules loaded via import().
    // Bare imports (like "vue") are normally externalized by Vite's fetchModule,
    // resolved using mainFields: ["main"] which often picks CJS entries.
    // We intercept bare imports, resolve them through the environment's plugin
    // pipeline (which respects resolve.conditions and picks ESM), then route
    // the resolved path through transformRequest for proper SSR processing.
    if (
      this.#preventExternalize &&
      !id.startsWith("file://") &&
      importer &&
      id[0] !== "." &&
      id[0] !== "/"
    ) {
      const resolved = await this.pluginContainer.resolveId(id, importer);
      if (resolved && !resolved.external) {
        return super.fetchModule(resolved.id, importer, options);
      }
    }
    return super.fetchModule(id, importer, options);
  }

  async dispatchFetch(request: Request): Promise<Response> {
    return this.devServer.fetch(request);
  }

  override async init(...args: any[]): Promise<void> {
    await this.devServer.init?.();
    await super.init(...args);
    this.devServer.sendMessage({
      type: "custom",
      event: "nitro:vite-env",
      data: { name: this.name, entry: this.#entry },
    });
  }
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
      const protocol = req.headers["sec-websocket-protocol"];
      if (protocol?.startsWith("vite-")) {
        // Vite HMR WebSocket connection
        return;
      }
      getEnvRunner(ctx).upgrade?.({ node: { req, socket, head } });
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

  // Worker => Host RPC
  nitroEnv.devServer.onMessage(async (message: any) => {
    if (message?.__rpc === "transformHTML") {
      try {
        const html = (await server.transformIndexHtml("/", message.data)).replace(
          "<!--ssr-outlet-->",
          `{{{ globalThis.__nitro_vite_envs__?.["ssr"]?.fetch($REQUEST) || "" }}}`
        );
        nitroEnv.devServer.sendMessage({ __rpc_id: message.__rpc_id, data: html });
      } catch (error) {
        nitroEnv.devServer.sendMessage({
          __rpc_id: message.__rpc_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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

    const baseURL = nitro.options.baseURL || "/";
    const originalURL = nodeReq.url;
    if (baseURL !== "/") {
      nodeReq.url = withBase(nodeReq.url, baseURL);
    }
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
      return await sendNodeResponse(nodeRes, envRes);
    } catch (error) {
      return next(error);
    } finally {
      if (baseURL !== "/") {
        nodeReq.url = originalURL;
      }
    }
  };

  // Handle server routes first to avoid conflicts with static assets served by Vite from the root
  // https://github.com/vitejs/vite/pull/20866
  server.middlewares.use(function nitroDevMiddlewarePre(req, res, next) {
    const fetchDest = req.headers["sec-fetch-dest"];
    const ext = req.url!.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1];
    const isNitroRoute = ext
      ? !!nitro.routing.routes.match(
          req.method || "",
          new URL(withBase(req.url!, nitro.options.baseURL), "http://localhost").pathname
        )
      : false;
    res.setHeader("vary", "sec-fetch-dest");
    if (
      // Originating from browser tab or no fetch dest (curl, fetch, etc) and (not script, style, image, etc)
      (!fetchDest || /^(document|iframe|frame|empty)$/.test(fetchDest)) &&
      // No file extension (not /src/index.ts) unless it is an explicit Nitro route
      (!ext || isNitroRoute) &&
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
