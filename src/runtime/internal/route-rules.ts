import defu from "defu";
import {
  type EventHandler,
  type H3Event,
  defineHandler,
  proxyRequest,
  redirect,
} from "h3";
import type { NitroRouteConfig, NitroRouteRules } from "nitro/types";
import { createRouter, addRoute, findAllRoutes } from "rou3";
import { joinURL, withQuery, withoutBase } from "ufo";
import { useRuntimeConfig } from "./config";

const config = useRuntimeConfig();

const routeRules = createRouter<NitroRouteConfig>();
for (const [route, rules] of Object.entries(config.nitro.routeRules!)) {
  addRoute(routeRules, undefined, route, rules);
}

export function createRouteRulesHandler(
  hybridFetch: typeof globalThis.fetch
): EventHandler {
  return defineHandler((event) => {
    // Match route options against path
    const routeRules = getRouteRules(event);
    // Apply headers options
    if (routeRules.headers) {
      for (const [key, value] of Object.entries(routeRules.headers)) {
        event.res.headers.set(key, value);
      }
    }
    // Apply redirect options
    if (routeRules.redirect) {
      let target = routeRules.redirect.to;
      if (target.endsWith("/**")) {
        let targetPath = event.url.pathname + event.url.search;
        const strpBase = (routeRules.redirect as any)._redirectStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.url.search) {
        target = withQuery(target, Object.fromEntries(event.url.searchParams));
      }
      return redirect(event, target, routeRules.redirect.status);
    }
    // Apply proxy options
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.url.pathname + event.url.search;
        const strpBase = (routeRules.proxy as any)._proxyStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.url.search) {
        target = withQuery(target, Object.fromEntries(event.url.searchParams));
      }
      return proxyRequest(event, target, {
        fetch: hybridFetch,
        ...routeRules.proxy,
      });
    }
  });
}

export function getRouteRules(event: H3Event): NitroRouteRules {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.url.pathname, useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}

// prettier-ignore
type DeepReadonly<T> = T extends Record<string, any>
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T;

/**
 * @param path - The path to match against route rules. This should not contain a query string.
 */
export function getRouteRulesForPath(
  path: string
): DeepReadonly<NitroRouteRules> {
  return defu(
    {},
    ...findAllRoutes(routeRules, undefined, path)
      .map((m) => m.data)
      .reverse()
  );
}
