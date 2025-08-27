import defu from "defu";
import {
  type EventHandler,
  H3Event,
  type HTTPEvent,
  defineHandler,
  getEventContext,
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

export function createRouteRulesHandler(): EventHandler {
  return defineHandler((event) => {
    // Match route options against path
    const routeRules = getRouteRules(event);
    if (!routeRules) {
      return;
    }

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
        ...routeRules.proxy,
      });
    }
  });
}

export function getRouteRules(event: HTTPEvent): NitroRouteRules | undefined {
  const context = getEventContext(event);
  context._nitro ??= {};
  if (!context._nitro.routeRules) {
    const url = (event as H3Event).url || new URL(event.req.url);
    context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(url.pathname, useRuntimeConfig().app.baseURL)
    );
  }
  return context._nitro?.routeRules;
}

/**
 * @param path - The path to match against route rules. This should not contain a query string.
 */
export function getRouteRulesForPath(path: string): NitroRouteRules {
  return defu(
    {},
    ...findAllRoutes(routeRules, undefined, path)
      .map((m) => m.data)
      .reverse()
  );
}
