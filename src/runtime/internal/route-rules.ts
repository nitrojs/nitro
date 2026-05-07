import { HTTPError, proxyRequest, redirect as sendRedirect, requireBasicAuth } from "h3";
import type { BasicAuthOptions, EventHandler, Middleware } from "h3";
import type { MatchedRouteRule, NitroRouteRules } from "nitro/types";
import { joinURL, withQuery, withoutBase } from "ufo";
import { defineCachedHandler } from "./cache.ts";

// Note: Remember to update RuntimeRouteRules in src/build/virtual/routing.ts when adding new route rules

type RouteRuleCtor<T extends keyof NitroRouteRules> = ((m: MatchedRouteRule<T>) => Middleware) & {
  order?: number;
};

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
        if (!isPathInScope(event.url.pathname, strpBase)) {
          throw new HTTPError({ status: 400 });
        }
        targetPath = withoutBase(targetPath, strpBase);
      } else if (targetPath.startsWith("//")) {
        targetPath = targetPath.replace(/^\/+/, "/");
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
        if (!isPathInScope(event.url.pathname, strpBase)) {
          throw new HTTPError({ status: 400 });
        }
        targetPath = withoutBase(targetPath, strpBase);
      } else if (targetPath.startsWith("//")) {
        targetPath = targetPath.replace(/^\/+/, "/");
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

// basicAuth auth route rule
// Must run before `redirect`/`proxy`/`cache` so unauthorized requests are
// neither redirected nor proxied.
export const basicAuth: RouteRuleCtor<"auth"> = /* @__PURE__ */ Object.assign(
  ((m) =>
    async function authRouteRule(event, next) {
      if (!m.options) {
        return;
      }
      await requireBasicAuth(event, m.options as BasicAuthOptions);
      return next();
    }) satisfies RouteRuleCtor<"auth">,
  { order: -1 }
);

// Check whether `pathname`, after canonicalization, stays within `base`.
// Prevents match/forward differentials where an encoded traversal like `..%2f`
// bypasses the `/**` scope at match time but escapes the base once the
// downstream (proxy upstream or redirect target) decodes `%2f` → `/`
// (GHSA-5w89-w975-hf9q).
//
// WHATWG URL keeps `%2F` and `%5C` opaque in paths, so we pre-decode those,
// then let `new URL` resolve `.`/`..`/`%2E%2E` segments and normalize `\`.
export function isPathInScope(pathname: string, base: string): boolean {
  let canonical: string;
  try {
    const pre = pathname.replace(/%2f/gi, "/").replace(/%5c/gi, "\\");
    canonical = new URL(pre, "http://_").pathname;
  } catch {
    return false;
  }
  return !base || canonical === base || canonical.startsWith(base + "/");
}
