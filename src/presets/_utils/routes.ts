import type { Nitro } from "nitro/types";
import { addRoute, createRouter, findOverlappingRoutes } from "rou3";

const CATCH_ALL_RE = /\*\*(?::\w+)?/g;
const METHOD_KEY_RE = /^([A-Za-z]+)\s+(\/.*)$/;
const HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "CONNECT",
  "TRACE",
  "QUERY",
]);

/**
 * Split a route rule key into its path and, for a method-scoped key such as
 * `GET /old/**`, the methods it applies to. Like h3, a `GET` rule also applies
 * to `HEAD` requests.
 */
export function parseRouteKey(key: string): { path: string; methods?: string[] } {
  const match = METHOD_KEY_RE.exec(key);
  const method = match?.[1]!.toUpperCase();
  if (!method || !HTTP_METHODS.has(method)) {
    return { path: key };
  }
  return { path: match![2]!, methods: method === "GET" ? ["GET", "HEAD"] : [method] };
}

/**
 * Warn and return `true` when a method-scoped route rule has to be left out of
 * a `_redirects` or `_headers` file, which cannot match by method.
 */
export function skipMethodScopedRoute(nitro: Nitro, route: string, file: string): boolean {
  if (!parseRouteKey(route).methods) {
    return false;
  }
  nitro.logger.warn(
    `Skipping method-scoped route rule \`${route}\` in \`${file}\`, which cannot match by HTTP method. The Nitro runtime still applies it` +
      (file === "_headers" ? ", but not to static assets." : ".")
  );
  return true;
}

/**
 * Sort route patterns from the most to the least specific, ranked like the
 * rou3 router ranks its matches: a pattern always comes before any pattern
 * that contains it, so that the first matching platform route wins.
 * Method-scoped keys are ranked by their path, before a key for all methods
 * with the same path, which they override at runtime.
 */
export function sortRoutes(routes: string[]): string[] {
  const router = createRouter<string>();
  const keys = routes.map((route) => [route, parseRouteKey(route)] as const);
  for (const [route, { path }] of [
    ...keys.filter(([_, key]) => !key.methods),
    ...keys.filter(([_, key]) => key.methods),
  ]) {
    addRoute(router, "", path, route);
  }
  return findOverlappingRoutes(router, "", "/**")
    .map((match) => match.data)
    .reverse();
}

/**
 * Convert a route pattern to the path syntax of `_redirects` and `_headers`
 * files (Netlify, Cloudflare Pages), where `*` (the splat) matches anything,
 * like a rou3 `*` or `**`, and `:name` matches one segment.
 */
export function routeToSplat(route: string): string {
  return route.replace(CATCH_ALL_RE, "*");
}

/**
 * `$n` reference to the trailing `/**` capture of a rou3 `routeToRegExp` regex,
 * which h3 interpolates for `**` in a `redirect` or `proxy` target.
 */
export function catchAllRef(src: RegExp): string {
  const groups = new RegExp(`${src.source}|`).exec("")!.length - 1;
  return `$${groups || 1}`;
}
