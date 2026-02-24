import { proxyRequest, redirect as sendRedirect } from "h3";
import type { EventHandler, Middleware } from "h3";
import type { MatchedRouteRule, NitroRouteRules } from "nitro/types";
import { joinURL, withQuery, withoutBase } from "ufo";
import { defineCachedHandler } from "./cache.ts";

// Note: Remember to update RuntimeRouteRules in src/routing.ts when adding new route rules

type RouteRuleCtor<T extends keyof NitroRouteRules> = (m: MatchedRouteRule<T>) => Middleware;

// Headers route rule
export const headers: RouteRuleCtor<"headers"> = ((m) =>
  function headersRouteRule(event) {
    for (const [key, value] of Object.entries(m.options || {})) {
      event.res.headers.set(key, value);
    }
  }) satisfies RouteRuleCtor<"headers">;

// Redirect route rule
export const redirect: RouteRuleCtor<"redirect"> = ((m) =>
  function redirectRouteRule(event) {
    let target = m.options?.to;
    if (!target) {
      return;
    }
    if (target.endsWith("/**")) {
      let targetPath = event.url.pathname + event.url.search;
      const strpBase = (m.options as any)._redirectStripBase;
      if (strpBase) {
        targetPath = withoutBase(targetPath, strpBase);
      }
      target = joinURL(target.slice(0, -3), targetPath);
    } else if (event.url.search) {
      target = withQuery(target, Object.fromEntries(event.url.searchParams));
    }
    return sendRedirect(target, m.options?.status);
  }) satisfies RouteRuleCtor<"redirect">;

// Proxy route rule
export const proxy: RouteRuleCtor<"proxy"> = ((m) =>
  function proxyRouteRule(event) {
    let target = m.options?.to;
    if (!target) {
      return;
    }
    if (target.endsWith("/**")) {
      let targetPath = event.url.pathname + event.url.search;
      const strpBase = (m.options as any)._proxyStripBase;
      if (strpBase) {
        targetPath = withoutBase(targetPath, strpBase);
      }
      target = joinURL(target.slice(0, -3), targetPath);
    } else if (event.url.search) {
      target = withQuery(target, Object.fromEntries(event.url.searchParams));
    }
    return proxyRequest(event, target, {
      ...m.options,
    });
  }) satisfies RouteRuleCtor<"proxy">;

// Cache route rule
export const cache: RouteRuleCtor<"cache"> = ((m) =>
  function cacheRouteRule(event, next) {
    if (!event.context.matchedRoute) {
      return next();
    }
    const cachedHandlers: Map<string, EventHandler> = ((globalThis as any).__nitroCachedHandlers ??=
      new Map());
    const { handler, route } = event.context.matchedRoute;
    const key = `${m.route}:${route}`;
    let cachedHandler = cachedHandlers.get(key);
    if (!cachedHandler) {
      cachedHandler = defineCachedHandler(handler, {
        group: "nitro/route-rules",
        name: key,
        ...m.options,
      });
      cachedHandlers.set(key, cachedHandler);
    }
    return cachedHandler(event);
  }) satisfies RouteRuleCtor<"cache">;
