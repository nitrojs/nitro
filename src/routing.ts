import type { Nitro, NitroEventHandler, NitroRouteRules } from "nitro/types";
import type { RouterContext } from "rou3";

import { join } from "pathe";
import { runtimeDir } from "nitro/runtime/meta";
import { addRoute, createRouter, findRoute, findAllRoutes } from "rou3";
import { compileRouterToString } from "rou3/compiler";
import { hash } from "ohash";

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

  const handlers = new Router<NitroEventHandler & { _id: string }>();
  const routeRules = new Router<NitroRouteRules>(true /* matchAll */);
  const middleware: NitroEventHandler[] = [];

  const sync = () => {
    // Update route rules
    routeRules._update(
      Object.entries(nitro.options.routeRules).map(([route, data]) => {
        return { route, method: "", data: serializableRouteRule(data) };
      })
    );

    // Update midleware
    const _middleware = [
      ...nitro.scannedHandlers,
      ...nitro.options.handlers,
    ].filter((h) => h && h.middleware && matchesEnv(h));
    if (nitro.options.serveStatic) {
      _middleware.unshift({
        route: "/**",
        middleware: true,
        handler: join(runtimeDir, "internal/static"),
      });
    }
    middleware.splice(0, middleware.length, ..._middleware);

    // Update handlers
    const _handlers = [
      ...nitro.scannedHandlers,
      ...nitro.options.handlers,
    ].filter((h) => h && !h.middleware && matchesEnv(h));

    if (nitro.options.renderer) {
      _handlers.push({
        route: "/**",
        lazy: true,
        handler: nitro.options.renderer,
      });
    }
    handlers._update(
      _handlers.map((h) => {
        return {
          route: h.route,
          method: h.method || "",
          data: serializableHandler(h),
        };
      })
    );
  };

  nitro.routing = Object.freeze({
    sync,
    handlers,
    routeRules,
    middleware,
  });
}

// --- Serializing ---

function serializableHandler(
  h: NitroEventHandler
): NitroEventHandler & { _id: string } {
  const id =
    (h ? "_lazy_" : "_") + hash(h.handler).replace(/-/g, "").slice(0, 6);
  return new Proxy(h, {
    get(_, prop, receiver) {
      if (prop === "_id") {
        return id;
      }
      if (prop === "toJSON") {
        return () => {
          // Serialized should be compatible with H3Route interface
          return `{${[
            `route:${JSON.stringify(h.route)}`,
            h.method && `method:${JSON.stringify(h.method)}`,
            h.meta && `meta:${JSON.stringify(h.meta)}`,
            `handler:${id}`,
          ]
            .filter(Boolean)
            .join(",")}}`;
        };
      }
      return Reflect.get(h, prop, receiver);
    },
  }) as any;
}

function serializableRouteRule(h: NitroRouteRules): NitroRouteRules {
  return new Proxy(h, {
    get(_, prop, receiver) {
      if (prop === "toJSON") {
        return () => {
          // RouteRuleEntry[]
          return `[${Object.entries(h)
            .filter(([_, options]) => options !== undefined)
            .map(([name, options]) => {
              return `{${[
                `name:${JSON.stringify(name)}`,
                `handler:__routeRules__.${name}`,
                `options:${JSON.stringify(options)}`,
              ]
                .filter(Boolean)
                .join(",")}}`;
            })
            .join(",")}]`;
        };
      }
      return Reflect.get(h, prop, receiver);
    },
  }) as any;
}

// --- Router ---

export interface Route<T = unknown> {
  route: string;
  method: string;
  data: T;
}

export class Router<T> {
  #routes?: Route<T>[];
  #router?: RouterContext<T>;
  #compiled?: string;
  #matchAll?: boolean;

  constructor(matchAll?: boolean) {
    this.#matchAll = matchAll ?? false;
    this._update([]);
  }

  get routes() {
    return this.#routes!;
  }

  _update(routes: Route<T>[]) {
    this.#routes = routes;
    this.#router = createRouter<T>();
    this.#compiled = undefined;
    for (const route of routes) {
      addRoute(this.#router, route.method, route.route, route.data);
    }
  }

  compileToString() {
    return (
      this.#compiled ||
      (this.#compiled = compileRouterToString(this.#router!, undefined, {
        matchAll: this.#matchAll,
      }))
    );
  }

  match(method: string, path: string): undefined | T {
    return findRoute(this.#router!, method, path)?.data;
  }

  matchAll(method: string, path: string): undefined | T[] {
    // Returns from less specific to more specific matches
    return findAllRoutes(this.#router!, method, path)?.map(
      (route) => route.data
    );
  }
}
