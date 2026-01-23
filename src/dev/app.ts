import type { Nitro } from "nitro/types";
import type { H3Event, HTTPHandler } from "h3";

import { H3, toEventHandler, serveStatic } from "h3";
import { joinURL } from "ufo";
import mime from "mime";
import { join, resolve, extname } from "pathe";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createGzip, createBrotliCompress } from "node:zlib";
import { createVFSHandler } from "./vfs.ts";
import { createHTTPProxy } from "../runner/proxy.ts";

import devErrorHandler, {
  defaultHandler as devErrorHandlerInternal,
  loadStackTrace,
} from "../runtime/internal/error/dev.ts";

export class NitroDevApp {
  nitro: Nitro;
  fetch: (req: Request) => Response | Promise<Response>;

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
      }
    }

    // Debugging endpoint to view vfs
    app.get("/_vfs/**", createVFSHandler(this.nitro));

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
    }

    // Main handler
    if (catchAllHandler) {
      app.all("/**", catchAllHandler);
    }

    return app;
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
