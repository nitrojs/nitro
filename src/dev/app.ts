import type { CompressOptions, Nitro } from "nitro/types";
import type { H3Event, HTTPHandler } from "h3";
import type { Hooks } from "crossws";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { H3, toEventHandler, serveStatic, HTTPError } from "h3";
import { joinURL, withoutBase } from "ufo";
import { addRoute, createRouter, findRoute } from "rou3";
import mime from "mime";
import { join, resolve, extname } from "pathe";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { createGzip, createBrotliCompress } from "node:zlib";
import { createVFSHandler } from "./vfs.ts";
import { createDevProxy, type DevProxy } from "./_proxy.ts";
import { isLocalDevRequest } from "./_request.ts";
import { createDevToolsJSONHandler, DEVTOOLS_JSON_ROUTE } from "./_devtools-json.ts";
import { DevReloadSignal, DEV_RELOAD_ROUTE } from "./_reload-signal.ts";
import { isCompressibleFile } from "../utils/compress.ts";

import devErrorHandler, {
  defaultHandler as devErrorHandlerInternal,
  loadStackTrace,
} from "../runtime/internal/error/dev.ts";

export class NitroDevApp {
  nitro: Nitro;
  fetch: (req: Request) => Response | Promise<Response>;
  /** Server reloads that open dev error pages wait for (see `withDevErrorRecovery`). */
  reloadSignal: DevReloadSignal = new DevReloadSignal();

  #wsProxies?: ReturnType<typeof createRouter<DevProxy>>;
  #routes = createRouter();

  constructor(nitro: Nitro, catchAllHandler?: HTTPHandler) {
    this.nitro = nitro;
    const app = this.#createApp(catchAllHandler);
    this.fetch = app.fetch.bind(app);
  }

  #createApp(catchAllHandler?: HTTPHandler) {
    // Init h3 app
    const app = new H3({
      debug: true,
      onError: async (error, event) => {
        const errorHandler = this.nitro.options.devErrorHandler || devErrorHandler;
        await loadStackTrace(error).catch(() => {});
        return errorHandler(error, event, {
          defaultHandler: devErrorHandlerInternal,
        });
      },
    });

    // Open dev error pages wait on it to reload (registered first so no catch-all shadows it)
    const reloadRoute = joinURL(this.nitro.options.baseURL, DEV_RELOAD_ROUTE);
    app.get(reloadRoute, (event) => this.reloadSignal.handle(event));
    this.#addRoute("GET", reloadRoute);

    // Dev-only handlers
    for (const h of this.nitro.options.devHandlers) {
      const handler = toEventHandler(h.handler);
      if (!handler) {
        this.nitro.logger.warn("Invalid dev handler:", h);
        continue;
      }
      if (h.middleware || !h.route) {
        // Middleware
        if (h.route) {
          app.use(h.route, handler, { method: h.method });
        } else {
          app.use(handler, { method: h.method });
        }
      } else {
        // Route
        app.on(h.method || "", h.route, handler, { meta: h.meta as any });
        this.#addRoute(h.method || "", h.route);
      }
    }

    // Chrome DevTools automatic workspace folders
    if (this.nitro.options.devServer?.devtoolsJson !== false) {
      const handler = createDevToolsJSONHandler(this.nitro);
      const routes = new Set([
        DEVTOOLS_JSON_ROUTE,
        joinURL(this.nitro.options.baseURL, DEVTOOLS_JSON_ROUTE),
      ]);
      for (const route of routes) {
        app.get(route, handler);
        this.#addRoute("GET", route);
      }
    }

    // Debugging endpoint to view vfs
    app.get("/_vfs/**", createVFSHandler(this.nitro));

    // Restrict the dev task runner to local requests, mirroring the VFS viewer.
    // The `/_nitro/tasks` routes are handled by the worker (via the catch-all)
    // and execute server tasks with caller-supplied payload; without this gate
    // they are reachable by any host that can reach the dev server, which binds
    // all interfaces by default (`devServer.hostname` is unset).
    const assertLocalTaskRequest = (event: H3Event) => {
      if (!isLocalDevRequest(event)) {
        throw new HTTPError({ statusText: "Forbidden IP", status: 403 });
      }
    };
    app.use("/_nitro/tasks", assertLocalTaskRequest);
    app.use("/_nitro/tasks/**", assertLocalTaskRequest);

    // Serve asset dirs
    for (const asset of this.nitro.options.publicAssets) {
      const assetBase = joinURL(this.nitro.options.baseURL, asset.baseURL || "/");
      app.use(joinURL(assetBase, "**"), (event) =>
        serveStaticDir(event, {
          dir: asset.dir,
          base: assetBase,
          fallthrough: asset.fallthrough,
          compress: this.nitro.options.compressPublicAssets,
        })
      );
      if (!asset.fallthrough && asset.baseURL && asset.baseURL !== "/") {
        this.#addRoute("", joinURL(assetBase, ":path+"));
      }
    }

    // User defined dev proxy
    const routes = Object.keys(this.nitro.options.devProxy).sort().reverse();
    for (const route of routes) {
      let opts = this.nitro.options.devProxy[route];
      if (typeof opts === "string") {
        opts = { target: opts };
      }
      const proxy = createDevProxy(opts);
      app.all(route, proxy.handleEvent);
      this.#addRoute("", route);
      if (opts.ws) {
        this.#wsProxies ??= createRouter();
        addRoute(this.#wsProxies, "", route, proxy);
      }
    }

    // Main handler
    if (catchAllHandler) {
      app.all("/**", catchAllHandler);
    }

    return app;
  }

  /**
   * Whether `path` (including the Nitro `baseURL`) matches an explicit dev app route: a dev handler
   * route, a dev proxy, or a public asset dir without fallthrough. Root catch-alls are excluded.
   */
  hasRoute(method: string, path: string): boolean {
    method = method.toUpperCase();
    return !!(
      findRoute(this.#routes, method, path) ||
      (method === "HEAD" && findRoute(this.#routes, "GET", path))
    );
  }

  #addRoute(method: string, route: string) {
    const path = withoutBase(route, this.nitro.options.baseURL);
    if (path !== "/**" && !path.startsWith("/**:")) {
      addRoute(this.#routes, method.toUpperCase(), route);
    }
  }

  /**
   * Proxy a WebSocket upgrade request if it matches a `devProxy` rule with `ws` enabled.
   *
   * @returns `true` if the socket was handed to a proxy, `false` if the caller should handle it.
   */
  proxyUpgrade(req: IncomingMessage, socket: Socket, head: any): boolean {
    const path = (req.url || "/").split("?")[0]!;
    const proxy = this.#findWSProxy(path);
    if (!proxy) {
      return false;
    }
    proxy.proxyUpgrade(req, socket, head).catch((error) => {
      this.nitro.logger.error(`Failed to proxy WebSocket upgrade for \`${path}\`:`, error);
      socket.destroy();
    });
    return true;
  }

  /**
   * Runtime-agnostic alternative to {@link proxyUpgrade}: resolve `crossws` hooks proxying a
   * WebSocket upgrade request to a matching `devProxy` rule with `ws` enabled.
   */
  resolveWebSocketProxy(req: Request): Promise<Partial<Hooks>> | undefined {
    return this.#findWSProxy(new URL(req.url).pathname)?.websocket();
  }

  #findWSProxy(path: string): DevProxy | undefined {
    return this.#wsProxies && findRoute(this.#wsProxies, "", path)?.data;
  }
}

// TODO: upstream to h3/node
function serveStaticDir(
  event: H3Event,
  opts: { dir: string; base: string; fallthrough?: boolean; compress?: boolean | CompressOptions }
) {
  const dir = resolve(opts.dir) + "/";
  const r = (id: string) => {
    if (!id.startsWith(opts.base) || !extname(id)) return;
    const resolved = join(dir, id.slice(opts.base.length));
    if (resolved.startsWith(dir)) {
      return resolved;
    }
  };

  const compress: CompressOptions =
    opts.compress === true ? { gzip: true, brotli: true } : opts.compress || {};

  return serveStatic(event, {
    fallthrough: opts.fallthrough,
    getMeta: async (id) => {
      const path = r(id);
      if (!path) return;
      const s = await stat(path).catch(() => null);
      if (!s?.isFile()) return;
      const ext = extname(path);
      return {
        size: s.size,
        mtime: s.mtime,
        type: mime.getType(ext) || "application/octet-stream",
      };
    },
    getContents(id) {
      const path = r(id);
      if (!path) return;
      const stream = createReadStream(path);
      const acceptEncoding = isCompressibleFile(path)
        ? event.req.headers.get("accept-encoding") || ""
        : "";
      if (compress.brotli && acceptEncoding.includes("br")) {
        event.res.headers.set("Content-Encoding", "br");
        event.res.headers.delete("Content-Length");
        event.res.headers.set("Vary", "Accept-Encoding");
        return toBody(event, stream.pipe(createBrotliCompress()));
      } else if (compress.gzip && acceptEncoding.includes("gzip")) {
        event.res.headers.set("Content-Encoding", "gzip");
        event.res.headers.delete("Content-Length");
        event.res.headers.set("Vary", "Accept-Encoding");
        return toBody(event, stream.pipe(createGzip()));
      }
      return toBody(event, stream) as any;
    },
  });
}

function toBody(event: H3Event, stream: Readable) {
  return event.runtime?.node ? stream : (Readable.toWeb(stream) as ReadableStream);
}
