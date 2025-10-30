import type { Nitro } from "nitro/types";
import type { EventHandler, HTTPHandler } from "h3";

import { withBase, H3, toEventHandler, fromNodeHandler } from "h3";
import serveStatic from "serve-static";
import { joinURL } from "ufo";
import { createVFSHandler } from "./vfs.ts";
import { createHTTPProxy } from "./proxy.ts";

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
        const errorHandler =
          this.nitro.options.devErrorHandler || devErrorHandler;
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
      const assetRoute = joinURL(
        this.nitro.options.runtimeConfig.app.baseURL,
        asset.baseURL || "/",
        "**"
      );
      // TODO: serve placeholder as fallback
      let handler: EventHandler = fromNodeHandler(
        // @ts-expect-error (HTTP2 types)
        serveStatic(asset.dir, { dotfiles: "allow" })
      );
      if (asset.baseURL?.length || 0 > 1) {
        handler = withBase(asset.baseURL!, handler);
      }
      app.use(assetRoute, handler);
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
