import type { Nitro } from "nitro/types";
import type { H3Event, HTTPHandler } from "h3";
import { createProxyServer, type ProxyServerOptions } from "httpxy";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { H3, toEventHandler, serveStatic, fromNodeHandler, HTTPError } from "h3";
import { joinURL, withoutBase } from "ufo";
import { addRoute, createRouter, findRoute } from "rou3";
import mime from "mime";
import { join, resolve, extname } from "pathe";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createGzip, createBrotliCompress } from "node:zlib";
import { createVFSHandler } from "./vfs.ts";
import { isLocalDevRequest } from "./_request.ts";
import { createDevToolsJSONHandler, DEVTOOLS_JSON_ROUTE } from "./_devtools-json.ts";

import devErrorHandler, {
  defaultHandler as devErrorHandlerInternal,
  loadStackTrace,
} from "../runtime/internal/error/dev.ts";

export class NitroDevApp {
  nitro: Nitro;
  fetch: (req: Request) => Response | Promise<Response>;

  #wsProxies?: ReturnType<typeof createRouter<ReturnType<typeof createHTTPProxy>>>;
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
      const proxy = createHTTPProxy(opts);
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
    if (!this.#wsProxies) {
      return false;
    }
    const path = (req.url || "/").split("?")[0]!;
    const match = findRoute(this.#wsProxies, "", path);
    if (!match) {
      return false;
    }
    match.data.proxy.ws(req, socket, {}, head).catch((error) => {
      this.nitro.logger.error(`Failed to proxy WebSocket upgrade for \`${path}\`:`, error);
      socket.destroy();
    });
    return true;
  }
}

// TODO: upstream to h3/node
function serveStaticDir(
  event: H3Event,
  opts: { dir: string; base: string; fallthrough?: boolean }
) {
  const dir = resolve(opts.dir) + "/";
  const r = (id: string) => {
    if (!id.startsWith(opts.base) || !extname(id)) return;
    const resolved = join(dir, id.slice(opts.base.length));
    if (resolved.startsWith(dir)) {
      return resolved;
    }
  };
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
      const acceptEncoding = event.req.headers.get("accept-encoding") || "";
      if (acceptEncoding.includes("br")) {
        event.res.headers.set("Content-Encoding", "br");
        event.res.headers.delete("Content-Length");
        event.res.headers.set("Vary", "Accept-Encoding");
        return stream.pipe(createBrotliCompress());
      } else if (acceptEncoding.includes("gzip")) {
        event.res.headers.set("Content-Encoding", "gzip");
        event.res.headers.delete("Content-Length");
        event.res.headers.set("Vary", "Accept-Encoding");
        return stream.pipe(createGzip());
      }
      return stream as any;
    },
  });
}

function createHTTPProxy(defaults: ProxyServerOptions = {}) {
  const proxy = createProxyServer({ xfwd: true, ...defaults });
  return {
    proxy,
    async handleEvent(event: H3Event, opts?: ProxyServerOptions) {
      try {
        return await fromNodeHandler((req, res) => {
          return proxy.web(req as IncomingMessage, res as ServerResponse, opts);
        })(event);
      } catch (error: any) {
        event.res.headers.set("refresh", "3");
        throw new HTTPError({
          status: 503,
          message: "Dev server is unavailable.",
          cause: error,
        });
      }
    },
  };
}
