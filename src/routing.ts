import type { Nitro, NitroEventHandler, NitroRouteRules } from "nitro/types";
import type { RouterContext } from "rou3";
import type { RouterCompilerOptions } from "rou3/compiler";

import { join } from "pathe";
import { runtimeDir } from "nitro/meta";
import { addRoute, createRouter, findRoute, findAllRoutes } from "rou3";
import { compileRouterToString } from "rou3/compiler";
import { hash } from "ohash";
import { normalizeRoute } from "./utils/route.ts";

const isGlobalMiddleware = (h: NitroEventHandler) => !h.method && (!h.route || h.route === "/**");

export function initNitroRouting(nitro: Nitro) {
  const envConditions = new Set(
    [
      nitro.options.dev ? "dev" : "prod",
      nitro.options.preset,
      nitro.options.preset === "nitro-prerender" ? "prerender" : undefined,
    ].filter(Boolean) as string[]
  );
  const matchesEnv = (h: NitroEventHandler) => {
    const hEnv = Array.isArray(h.env) ? h.env : [h.env];
    const envs = hEnv.filter(Boolean) as string[];
    return envs.length === 0 || envs.some((env) => envConditions.has(env));
  };

  type MaybeArray<T> = T | T[];
  const routes = new Router<MaybeArray<NitroEventHandler & { _importHash: string }>>(
    nitro.options.baseURL
  );

  // Matched with route *patterns* at build time (presets), never with a request
  // path — the runtime rules matcher is compiled from `options.routeRules` by
  // `h3/rules`, which normalizes in the opposite direction (patterns decoded).
  const routeRules = new Router<NitroRouteRules & { _route: string }>(nitro.options.baseURL, {
    normalize: false,
  });

  const globalMiddleware: (NitroEventHandler & { _importHash: string })[] = [];

  const routedMiddleware = new Router<NitroEventHandler & { _importHash: string }>(
    nitro.options.baseURL
  );

  const sync = () => {
    // Update route rules
    routeRules._update(
      Object.entries(nitro.options.routeRules).map(([route, data]) => ({
        route,
        method: "",
        data: {
          ...data,
          _route: route,
        },
      }))
    );

    // Update routes
    const _routes = [
      ...Object.entries(nitro.options.routes).flatMap(([route, handler]) => {
        if (typeof handler === "string") {
          handler = { handler };
        }
        return { ...handler, route, middleware: false };
      }),
      ...nitro.options.handlers,
      ...nitro.scannedHandlers,
    ].filter((h) => h && !h.middleware && matchesEnv(h));
    if (nitro.options.serverEntry && nitro.options.serverEntry.handler) {
      _routes.push({
        route: "/**",
        lazy: false,
        format: nitro.options.serverEntry.format,
        handler: nitro.options.serverEntry.handler,
      });
    }
    if (nitro.options.renderer?.handler) {
      _routes.push({
        route: "/**",
        lazy: true,
        handler: nitro.options.renderer?.handler,
      });
    }
    routes._update(
      _routes.map((h) => ({
        ...h,
        method: h.method || "",
        data: handlerWithImportHash(h),
      })),
      { merge: true }
    );

    // Update middleware
    const _middleware = [...nitro.scannedHandlers, ...nitro.options.handlers].filter(
      (h) => h && h.middleware && matchesEnv(h)
    );
    if (nitro.options.serveStatic) {
      _middleware.unshift({
        route: "/**",
        middleware: true,
        handler: join(runtimeDir, "internal/static"),
      });
    }
    globalMiddleware.splice(
      0,
      globalMiddleware.length,
      ..._middleware.filter((h) => isGlobalMiddleware(h)).map((m) => handlerWithImportHash(m))
    );
    routedMiddleware._update(
      _middleware
        .filter((h) => !isGlobalMiddleware(h))
        .map((h) => ({
          ...h,
          method: h.method || "",
          data: handlerWithImportHash(h),
        }))
    );
  };

  nitro.routing = Object.freeze({
    sync,
    routes,
    routeRules,
    globalMiddleware,
    routedMiddleware,
  });
}

function handlerWithImportHash(h: NitroEventHandler) {
  const id = (h.lazy ? "_lazy_" : "_") + hash(h.handler).replace(/-/g, "").slice(0, 6);
  return { ...h, _importHash: id };
}

// --- Router ---

export interface Route<T = unknown> {
  route: string;
  method: string;
  data: T;
}

export interface RouterOptions {
  /**
   * Normalize each pattern into the shape of the `event.url.pathname` it will be
   * matched against (percent-encoding, needless-escape decoding, dot segments),
   * mirroring what h3 does in its own `on()`.
   *
   * Turn this off for a router that is matched with another *pattern* rather
   * than with a request path — the two sides would otherwise normalize
   * differently and stop matching.
   *
   * @default true
   */
  normalize?: boolean;
}

export class Router<T> {
  _routes?: Route<T>[];
  _router?: RouterContext<T>;
  _compiled?: Record<string, string>;
  _baseURL: string;
  _normalize: boolean;

  constructor(baseURL?: string, opts?: RouterOptions) {
    this._normalize = opts?.normalize !== false;
    this._update([]);
    this._baseURL = baseURL ? (this._normalize ? normalizeRoute(baseURL) : baseURL) : "";
    if (this._baseURL.endsWith("/")) {
      this._baseURL = this._baseURL.slice(0, -1);
    }
  }

  get routes() {
    return this._routes!;
  }

  _update(routes: Route<T>[], opts?: { merge?: boolean }) {
    this._routes = routes;
    this._router = createRouter<T>();
    this._compiled = undefined;
    for (const route of routes) {
      const pattern = this._normalize ? normalizeRoute(route.route) : route.route;
      addRoute(this._router, route.method, this._baseURL + pattern, route.data);
    }
    if (opts?.merge) {
      mergeCatchAll(this._router);
    }
  }

  hasRoutes() {
    return this._routes!.length > 0;
  }

  compileToString(opts?: RouterCompilerOptions<T>) {
    const key = opts ? hash(opts) : "";
    this._compiled ||= {};
    if (this._compiled[key]) {
      return this._compiled[key];
    }
    this._compiled[key] = compileRouterToString(this._router!, undefined, opts);

    // TODO: Upstream to rou3 compiler
    const onlyWildcard =
      this.routes.length === 1 && this.routes[0].route === "/**" && this.routes[0].method === "";
    if (onlyWildcard) {
      // Optimize for single wildcard route
      const data = (opts?.serialize || JSON.stringify)(this.routes[0].data);
      let retCode = `{data,params:{"_":p.slice(1)}}`;
      if (opts?.matchAll) {
        retCode = `[${retCode}]`;
      }
      this._compiled[key] =
        /* js */ `/* @__PURE__ */ (() => {const data=${data};return ((_m, p)=>{return ${retCode};})})()`;
    }

    return this._compiled[key];
  }

  match(method: string, path: string): undefined | T {
    return findRoute(this._router!, method, path)?.data;
  }

  matchAll(method: string, path: string): T[] {
    // Returns from less specific to more specific matches
    return findAllRoutes(this._router!, method, path).map((route) => route.data);
  }
}

function mergeCatchAll(router: RouterContext<unknown>) {
  const handlers = router.root?.wildcard?.methods?.[""];
  if (!handlers || handlers.length < 2) {
    return;
  }
  handlers.splice(0, handlers.length, {
    ...handlers[0],
    data: handlers.map((h) => h.data),
  });
}
