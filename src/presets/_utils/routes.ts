import type { Nitro } from "nitro/types";
import { addRoute, createRouter, findOverlappingRoutes } from "rou3";

const CATCH_ALL_RE = /\*\*(?::\w+)?/g;

/**
 * Sort route patterns from the most to the least specific, ranked like the
 * rou3 router ranks its matches: a pattern always comes before any pattern
 * that contains it, so that the first matching platform route wins.
 */
export function sortRoutes(routes: string[]): string[] {
  const router = createRouter<string>();
  for (const route of routes) {
    addRoute(router, "", route, route);
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

// placeholder names must start with a letter in `_redirects` and `_headers`
const NAMED_PARAM_RE = /^:[A-Za-z]\w*$/;
const SPECIAL_CHARS_RE = /[*:?+(){}]/;

/**
 * Whether a route pattern can be written in the `_redirects` and `_headers`
 * path syntax, which only has static segments, `:name` params and a trailing
 * splat. Patterns such as `:id(\d+)`, `:id?`, `{b}?`, `*.png` or a `**` with
 * segments after it would produce invalid lines.
 */
export function isSplatExpressible(route: string): boolean {
  const segments = routeToSplat(route).split("/");
  return segments.every((segment, index) =>
    segment === "*"
      ? index === segments.length - 1
      : NAMED_PARAM_RE.test(segment) || !SPECIAL_CHARS_RE.test(segment)
  );
}

/**
 * Warn and return `true` when a route rule has to be left out of a
 * `_redirects` or `_headers` file because of {@link isSplatExpressible}.
 */
export function skipUnexpressibleRoute(nitro: Nitro, route: string, file: string): boolean {
  if (isSplatExpressible(route)) {
    return false;
  }
  nitro.logger.warn(
    `Skipping route rule \`${route}\` in \`${file}\`: the pattern cannot be expressed in its path syntax.`
  );
  return true;
}

/**
 * `$n` reference to the trailing `/**` capture of a rou3 `routeToRegExp` regex,
 * which h3 interpolates for `**` in a `redirect` or `proxy` target.
 */
export function catchAllRef(src: RegExp): string {
  const groups = new RegExp(`${src.source}|`).exec("")!.length - 1;
  return `$${groups || 1}`;
}
