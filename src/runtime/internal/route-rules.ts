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
// `event.url.pathname` is NOT `decodeURI`-d: h3 exposes it via srvx's `FastURL`,
// which keeps percent-encodings opaque (`%2f`, `%5c`, `%20`, non-ASCII, and any
// `%2e` that isn't a whole dot-segment all stay encoded) while WHATWG-resolving
// *literal* `.`/`..` segments and converting `\` → `/`. So an encoded separator
// survives there, and a request can still dodge a narrower rule (e.g. a
// `basicAuth` gate) or escape a `/**` scope that the served path would match
// once the downstream decodes `%2f` → `/` (GHSA-5w89-w975-hf9q). We decode
// `%2f`/`%5c` (and `%2e` dot-segments) and resolve the revealed `.`/`..`.
//
// Kept as string ops, NOT `new URL`: `new URL` would leave `%2f`/`%5c` opaque
// (the very separators we must decode) and re-encode chars like `^`. We also
// must NOT decode `%20`/non-ASCII, so the canonical path stays in the same
// representation as `event.url.pathname` and matches route rules consistently.
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
  return isCanonicalInScope(canonicalPath(pathname), base);
}

function isCanonicalInScope(canonical: string, base: string): boolean {
  return !base || canonical === base || canonical.startsWith(base + "/");
}
