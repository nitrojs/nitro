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
      let targetPath = canonicalPath(event.url.pathname) + event.url.search;
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
      let targetPath = canonicalPath(event.url.pathname) + event.url.search;
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
// `event.url.pathname` is already `decodeURI`-d by h3, but `%2f`/`%5c` stay
// opaque there (`/` and `\` are reserved for `decodeURI`). We decode those
// separators too and resolve `.`/`..`/`%2e` segments, so a request cannot
// dodge a narrower rule (e.g. a `basicAuth` gate) or escape a `/**` scope that
// the served path would still match once the downstream decodes `%2f` → `/`
// (GHSA-5w89-w975-hf9q).
//
// Done with string ops (mirroring h3's internal `resolveDotSegments`) rather
// than `new URL`, which would re-encode characters h3 already decoded (e.g.
// spaces, non-ASCII) and desync matching from h3's `event.url.pathname`.
//
// Matches a `.`/`..` path segment — the only `.`-related case the slow path
// resolves. A bare `.` inside a segment (e.g. `app.1a2b.js`) never changes the
// path and must stay on the fast path; this runs on every request.
const DOT_SEGMENT_RE = /(?:^|\/)\.\.?(?:\/|$)/;

export function canonicalPath(pathname: string): string {
  if (!pathname.includes("%") && !pathname.includes("\\") && !DOT_SEGMENT_RE.test(pathname)) {
    return pathname;
  }
  const segments = pathname
    .replace(/%2f/gi, "/")
    .replace(/%5c/gi, "\\")
    .replaceAll("\\", "/")
    .split("/");
  const resolved: string[] = [];
  for (const segment of segments) {
    const normalized = segment.replace(/%2e/gi, ".");
    if (normalized === "..") {
      if (resolved.length > 1) resolved.pop();
    } else if (normalized !== ".") {
      resolved.push(segment);
    }
  }
  return resolved.join("/") || "/";
}

export function isPathInScope(pathname: string, base: string): boolean {
  const canonical = canonicalPath(pathname);
  return !base || canonical === base || canonical.startsWith(base + "/");
}
