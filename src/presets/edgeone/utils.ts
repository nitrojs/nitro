/**
 * EdgeOne Pages Build Output API v3 config generator.
 *
 * Writes `.edgeone/cloud-functions/ssr-node/config.json` describing how the
 * platform should route incoming requests between static assets (served from
 * `.edgeone/assets/`) and the SSR function (`handler.js`).
 *
 * Spec: https://pages.edgeone.ai/document/building-output-configuration
 */
import type { Nitro } from "nitro/types";
import { join } from "pathe";
import { joinURL } from "ufo";
import { writeFile } from "../../utils/fs.ts";

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

/**
 * Convert a Nitro/h3 route pattern to a RE2-compatible regex string.
 *
 * EdgeOne's `routes[].src` uses Go's RE2 engine (no lookaround, no backrefs).
 * We do this in a single pass so a later replacement can't match a token
 * (e.g. the `*` inside `(.*)`) that a previous replacement just inserted.
 *
 *   "/about"          -> "^/about$"
 *   "/api/posts/:id"  -> "^/api/posts/([^/]+)$"
 *   "/blog/*"         -> "^/blog/([^/]+)$"
 *   "/blog/**"        -> "^/blog/(.*)$"
 */
function routeToRegex(route: string, baseURL = "/"): string {
  const withBase = joinURL(baseURL, route);
  return (
    "^" +
    withBase.replace(/\*\*|\*|:[^/]+/g, (m) => {
      if (m === "**") return "(.*)";
      return "([^/]+)";
    }) +
    "$"
  );
}

export async function writeEdgeOneConfig(nitro: Nitro) {
  nitro.routing.sync();

  const baseURL = nitro.options.baseURL || "/";

  const config: EdgeOneConfig = {
    version: 3,
    routes: [],
  };

  // Phase 1 — rules evaluated before the filesystem handler (redirects, headers).
  // Sorted shallow-to-deep so more specific rules override more general ones.
  const rules = Object.entries(nitro.options.routeRules || {}).sort(
    (a, b) => a[0].split(/\/(?!\*)/).length - b[0].split(/\/(?!\*)/).length
  );

  config.routes.push(
    ...rules
      .filter(([_, routeRules]) => routeRules.redirect || routeRules.headers)
      .map(([path, routeRules]) => {
        const route: SourceRoute = {
          src: routeToRegex(path, baseURL),
        };
        if (routeRules.redirect) {
          route.status = routeRules.redirect.status || 302;
          route.headers = {
            Location: joinURL(baseURL, routeRules.redirect.to.replace("/**", "/$1")),
          };
        }
        if (routeRules.headers) {
          route.headers = { ...route.headers, ...(routeRules.headers as Record<string, string>) };
          if (!routeRules.redirect) {
            route.continue = true;
          }
        }
        return route;
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
      src: routeToRegex(route.path, baseURL),
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
    if (apiRoutes.some((r) => r.path === route)) {
      continue;
    }
    config.routes.push({
      src: routeToRegex(route, baseURL),
    });
  }

  // Final catch-all forwards anything unmatched above to the SSR function.
  // Includes requests without the baseURL prefix so the runtime can redirect
  // or normalize them instead of returning a platform-level 404.
  config.routes.push({
    src: "^" + joinURL(baseURL, "/(.*)") + "$",
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
