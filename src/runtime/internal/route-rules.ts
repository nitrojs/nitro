import {
  HTTPError,
  proxyRequest,
  redirect as sendRedirect,
  requireBasicAuth,
  resolveDotSegments,
} from "h3";
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
      // Forward `event.url.pathname`: encoded separators (`%2f`/`%5c`) stay
      // opaque, so the target receives the original separators and resolves the
      // resource the client requested — like nginx `proxy_pass $request_uri`,
      // not the path-decoding `proxy_pass <uri>/` form. The scope check below
      // canonicalizes (decodes `%2f`/`%5c`, resolves `..`) to reject traversal
      // that only surfaces once the downstream decodes those separators.
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
      // Forward `event.url.pathname`: encoded separators (`%2f`/`%5c`) stay
      // opaque, so the upstream receives the original separators and resolves
      // the resource the client requested — like nginx `proxy_pass $request_uri`,
      // not the path-decoding `proxy_pass <uri>/` form. The scope check below
      // canonicalizes (decodes `%2f`/`%5c`, resolves `..`) to reject traversal
      // that only surfaces once the upstream decodes those separators.
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

// Canonicalize a request pathname for route-rule matching and scope checks.
//
// Delegates to h3's `resolveDotSegments`, which decodes `%2f`/`%5c` separators
// (`decodeSlashes`) and `%2e` dot segments — at any `%25`-nesting depth — then
// resolves the revealed `.`/`..` without escaping above root. Other encodings
// (`%20`, non-ASCII, `%3A`, …) stay opaque, so the result keeps the same
// representation as the un-decoded `event.url.pathname` and matches rules
// consistently.
//
// `decodeSlashes` is required here (unlike routing/dispatch): the result gates
// auth and feeds proxy/redirect scope checks, where a downstream decodes
// `%2f` → `/` and would otherwise let an encoded separator dodge a narrower rule
// (e.g. a `basicAuth` gate) or escape a `/**` scope that the served path would
// match (GHSA-5w89-w975-hf9q). Never use the result for routing/dispatch.
export function canonicalPath(pathname: string): string {
  return resolveDotSegments(pathname, { decodeSlashes: true });
}

export function isPathInScope(pathname: string, base: string): boolean {
  return isCanonicalInScope(canonicalPath(pathname), base);
}

function isCanonicalInScope(canonical: string, base: string): boolean {
  return !base || canonical === base || canonical.startsWith(base + "/");
}
