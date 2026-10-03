/**
 * EdgeOne Pages Build Output API v3 config generator.
 *
 * Writes `.edgeone/cloud-functions/ssr-node/config.json` describing how the
 * platform should route incoming requests between static assets (served from
 * `.edgeone/assets/`) and the SSR function (`handler.js`).
 *
 * Spec: https://pages.edgeone.ai/document/building-output-configuration
 */
import type { Nitro, RedirectRuleOptions } from "nitro/types";
import { join } from "pathe";
import { compareRoutes, routeToRegExp } from "rou3";
import { hasProtocol, joinURL } from "ufo";
import { writeFile } from "../../utils/fs.ts";
import { catchAllRef, sortRoutes } from "../_utils/routes.ts";

const NAMED_GROUP_RE = /\(\?<(?![=!])[^>]+>/g;

type SourceRoute = {
  src: string;
  dest?: string;
  headers?: Record<string, string>;
  methods?: string[];
  continue?: boolean;
  status?: number;
};

type HandlerRoute = {
  handle: "filesystem";
};

type Route = SourceRoute | HandlerRoute;

interface EdgeOneConfig {
  version: 3;
  routes: Route[];
}

export async function writeEdgeOneConfig(nitro: Nitro) {
  nitro.routing.sync();

  const baseURL = nitro.options.baseURL || "/";

  const config: EdgeOneConfig = {
    version: 3,
    routes: [],
  };

  // Phase 1 — rules evaluated before the filesystem handler (headers, redirects).
  const rules = sortRoutes(Object.keys(nitro.options.routeRules || {})).map(
    (path) => [path, nitro.options.routeRules[path]] as const
  );

  config.routes.push(
    // Header-only rules (least specific first, so more specific headers override on `continue`)
    ...rules
      .filter(([_, routeRules]) => routeRules.headers && !routeRules.redirect)
      .reverse()
      .map(([path, routeRules]) => ({
        src: routeToRE2(joinURL(baseURL, path)).source,
        headers: routeRules.headers as Record<string, string>,
        continue: true,
      })),
    // Redirect rules (most specific first, as the first match stops routing)
    ...rules
      .filter(([_, routeRules]) => routeRules.redirect)
      .map(([path, routeRules]) => {
        const redirect = routeRules.redirect as RedirectRuleOptions;
        const src = routeToRE2(joinURL(baseURL, path));
        const to = redirect.to.replaceAll("**", catchAllRef(src));
        return {
          src: src.source,
          status: redirect.status || 302,
          headers: {
            Location: hasProtocol(to, { acceptRelative: true }) ? to : joinURL(baseURL, to),
            ...(routeRules.headers as Record<string, string>),
          },
        };
      })
  );

  // The filesystem handler serves any matching file under `.edgeone/assets/`.
  // Requests that don't match a static file fall through to the rules below,
  // which forward dynamic paths to the SSR function.
  config.routes.push({ handle: "filesystem" });

  // Phase 2 — dynamic routes evaluated after the filesystem handler.
  const apiRoutes = nitro.routing.routes.routes
    .filter((route) => {
      const handler = Array.isArray(route.data) ? route.data[0] : route.data;
      return handler && !handler.middleware && route.route !== "/**";
    })
    .map((route) => ({
      path: route.route,
      method: route.method || "*",
    }));

  for (const route of apiRoutes) {
    const sourceRoute: SourceRoute = {
      src: routeToRE2(joinURL(baseURL, route.path)).source,
    };
    if (route.method !== "*") {
      sourceRoute.methods = [route.method.toUpperCase()];
    }
    config.routes.push(sourceRoute);
  }

  // SSR page routes declared by the framework (e.g. Nuxt) plus any scanned handlers.
  const ssrRoutes = [
    ...new Set([
      ...(nitro.options.ssrRoutes || []),
      ...[...nitro.scannedHandlers, ...nitro.options.handlers]
        .filter((h) => !h.middleware && h.route && h.route !== "/**")
        .map((h) => h.route!),
    ]),
  ];

  for (const route of ssrRoutes) {
    if (apiRoutes.some((r) => compareRoutes(r.path, route) === "equal")) {
      continue;
    }
    config.routes.push({
      src: routeToRE2(joinURL(baseURL, route)).source,
    });
  }

  // Final catch-all forwards anything unmatched above to the SSR function.
  // Includes requests without the baseURL prefix so the runtime can redirect
  // or normalize them instead of returning a platform-level 404.
  config.routes.push({
    src: routeToRE2(joinURL(baseURL, "/**")).source,
  });
  if (baseURL !== "/") {
    config.routes.push({
      src: "^/(.*)$",
    });
  }

  const configContent = JSON.stringify(config, null, 2);
  await writeFile(join(nitro.options.output.serverDir, "config.json"), configContent, true);

  return {
    apiRoutes,
  };
}

/**
 * rou3 `routeToRegExp` with named groups made plain. EdgeOne matches
 * `routes[].src` with Go's RE2 engine, which only reads `(?<name>…)` since Go
 * 1.22. Group numbers, and so `$n` references, are unchanged.
 */
function routeToRE2(route: string): RegExp {
  return new RegExp(routeToRegExp(route).source.replace(NAMED_GROUP_RE, "("));
}
