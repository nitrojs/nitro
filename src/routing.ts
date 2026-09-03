import type { Nitro, NitroEventHandler, NitroRouteRules } from "nitro/types";
import type { RouterContext } from "rou3";
import type { RouterCompilerOptions } from "rou3/compiler";

import { join } from "pathe";
import { runtimeDir } from "nitro/meta";
import { addRoute, createRouter, findRoute, findAllRoutes } from "rou3";
import { compileRouterToString } from "rou3/compiler";
import { hash } from "./utils/hash.ts";
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
  const id = (h.lazy ? "_lazy_" : "_") + hash(h.handler);
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
  /**
   * Cached output of {@link compileToString}, invalidated by {@link _update}.
   *
   * Only one result is cached: each Router instance must always be compiled with
   * the same `opts`. Compiling one instance with differing `opts` would silently
   * return the first result, since `opts` holds a `serialize` closure and is
   * therefore not hashable into a cache key.
   */
  _compiled?: string;
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
      mergeCatchAll(this._router, this._baseURL);
    }
  }

  hasRoutes() {
    return this._routes!.length > 0;
  }

  compileToString(opts?: RouterCompilerOptions<T>) {
    if (this._compiled) {
      return this._compiled;
    }
    this._compiled = compileRouterToString(this._router!, undefined, opts);

    // TODO: Upstream to rou3 compiler
    const onlyWildcard =
      this.routes.length === 1 && this.routes[0].route === "/**" && this.routes[0].method === "";
    if (onlyWildcard) {
      // Optimize for single wildcard route
      const data = (opts?.serialize || JSON.stringify)(this.routes[0].data);
      const base = this._baseURL;
      let retCode = `{data,params:{"_":p.slice(${base.length + 1})}}`;
      if (opts?.matchAll) {
        retCode = `[${retCode}]`;
      }
      const guardCode = base
        ? `if(p!==${JSON.stringify(base)}&&!p.startsWith(${JSON.stringify(base + "/")})){return ${opts?.matchAll ? "[]" : "undefined"};}`
        : "";
      this._compiled = /* js */ `/* @__PURE__ */ (() => {const data=${data};return ((_m, p)=>{${guardCode}return ${retCode};})})()`;
    }

    return this._compiled;
  }

  match(method: string, path: string): undefined | T {
    return findRoute(this._router!, method, path)?.data;
  }

  matchAll(method: string, path: string): T[] {
    // Returns from less specific to more specific matches
    return findAllRoutes(this._router!, method, path).map((route) => route.data);
  }
}

function mergeCatchAll(router: RouterContext<unknown>, baseURL: string) {
  let node: RouterContext<unknown>["root"] | undefined = router.root;
  for (const segment of baseURL.split("/")) {
    if (!segment) {
      continue;
    }
    node = node?.static?.[segment];
    if (!node) {
      return;
    }
  }
  const handlers = node?.wildcard?.methods?.[""];
  if (!handlers || handlers.length < 2) {
    return;
  }
  handlers.splice(0, handlers.length, {
    ...handlers[0],
    data: handlers.map((h) => h.data),
  });
}
