import type { Nitro, NormalizedRouteRules } from "nitro/types";
import { addRoute, compareRoutes, createRouter, findOverlappingRoutes } from "rou3";

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
// placeholder names must start with a letter in `_redirects` and `_headers`
const NAMED_PARAM_RE = /^:[A-Za-z]\w*$/;
const SPECIAL_CHARS_RE = /[*:?+(){}]/;
const SPLAT_SEGMENT_RE = /^[^*:?+(){}]*\*[^*:?+(){}]*$/;

type PlatformRouteFile = "_redirects" | "_headers";

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
 * Warn and return `true` when a route rule has to be left out of a
 * `_redirects` or `_headers` file: a method-scoped rule, as the file cannot
 * match by method, or a pattern that its path syntax cannot express (see
 * {@link isSplatExpressible}).
 *
 * With `routes`, the other rules of a file where the first match wins, a rule
 * that would shadow a skipped one (see {@link findShadowedRoute}) is left out
 * too, so that the runtime handles all of their requests.
 */
export function skipUnsupportedRoute(
  nitro: Nitro,
  opts: { route: string; file: PlatformRouteFile; routes?: string[] }
): boolean {
  const { route, file } = opts;
  const reason = unsupportedReason(route, file);
  if (reason) {
    nitro.logger.warn(
      `Skipping route rule \`${route}\` in \`${file}\`, ${reason}. The Nitro runtime still applies it` +
        (file === "_headers" ? ", but not to static assets." : ".")
    );
    return true;
  }
  const shadowed =
    opts.routes &&
    findShadowedRoute(
      route,
      opts.routes.filter((key) => unsupportedReason(key, file))
    );
  if (!shadowed) {
    return false;
  }
  nitro.logger.warn(
    `Skipping route rule \`${route}\` in \`${file}\`, as it would take precedence over the skipped route rule \`${shadowed}\`. The Nitro runtime still applies both.`
  );
  return true;
}

/**
 * Whether a route pattern can be written in the path syntax of a `_redirects`
 * or `_headers` file, which only has static segments, `:name` params and one
 * `*` splat. The splat has to be the last segment in `_redirects`, while in
 * `_headers` it can be anywhere, as in `/files/*.png`, matching across `/`
 * like a rou3 `*`. Patterns such as `:id(\d+)`, `:id?`, `{b}?` or a `**`
 * with segments after it cannot be expressed.
 */
export function isSplatExpressible(route: string, opts: { file: PlatformRouteFile }): boolean {
  const segments = routeToSplat(route).split("/");
  return segments.every(
    (segment, index) =>
      NAMED_PARAM_RE.test(segment) ||
      !SPECIAL_CHARS_RE.test(segment) ||
      (segment === "*" && index === segments.length - 1) ||
      (opts.file === "_headers" && !route.includes("**") && SPLAT_SEGMENT_RE.test(segment))
  );
}

/**
 * The first of the `skipped` route rule keys whose requests `route` also
 * matches, unless `route` is more specific. Where the first match wins, it
 * would answer requests that the runtime gives to the skipped rule.
 */
export function findShadowedRoute(route: string, skipped: string[]): string | undefined {
  const { path } = parseRouteKey(route);
  return skipped.find((key) => {
    const comparison = compareRoutes(path, parseRouteKey(key).path);
    return comparison !== "subset" && comparison !== "disjoint";
  });
}

/**
 * Sort route patterns from the most to the least specific, ranked like the
 * rou3 router ranks its matches: a pattern always comes before any pattern
 * that contains it, so that the first matching platform route wins.
 * Method-scoped keys are ranked by their path, before a key for all methods
 * with the same path, and `HEAD` before `GET`, as they override at runtime.
 */
export function sortRoutes(routes: string[]): string[] {
  const router = createRouter<string>();
  const keys = routes.map((route) => [route, methodRank(route)] as const);
  for (const [route] of keys.sort((a, b) => a[1] - b[1])) {
    addRoute(router, "", parseRouteKey(route).path, route);
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
 * Whether a route rule sets any static `headers`. A rule can have empty
 * `headers` (`cors` alone is applied at runtime), which platform configs
 * reject (Vercel) or would write as an empty entry.
 */
export function hasHeaders(routeRules: Pick<NormalizedRouteRules, "headers">): boolean {
  return Object.keys(routeRules.headers || {}).length > 0;
}

/**
 * `$n` reference to the trailing `/**` capture of a rou3 `routeToRegExp` regex,
 * which h3 interpolates for `**` in a `redirect` or `proxy` target.
 */
export function catchAllRef(src: RegExp): string {
  const groups = new RegExp(`${src.source}|`).exec("")!.length - 1;
  return `$${groups || 1}`;
}

function unsupportedReason(route: string, file: PlatformRouteFile): string | undefined {
  const { path, methods } = parseRouteKey(route);
  if (methods) {
    return "as it cannot match by HTTP method";
  }
  if (!isSplatExpressible(path, { file })) {
    return "as its path syntax cannot express the pattern";
  }
}

function methodRank(route: string): number {
  const methods = parseRouteKey(route).methods;
  return methods ? (methods[0] === "HEAD" ? 2 : 1) : 0;
}
