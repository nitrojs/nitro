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

/**
 * `$n` reference to the trailing `/**` capture of a rou3 `routeToRegExp` regex,
 * which h3 interpolates for `**` in a `redirect` or `proxy` target.
 */
export function catchAllRef(src: RegExp): string {
  const groups = new RegExp(`${src.source}|`).exec("")!.length - 1;
  return `$${groups || 1}`;
}
