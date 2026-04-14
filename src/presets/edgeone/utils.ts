import type { Nitro } from "nitro/types";
import { join } from "pathe";
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
 * Convert a Nitro route pattern to a RE2-compatible regex string.
 * e.g. "/api/posts/:id" -> "^/api/posts/([^/]+)$"
 *      "/blog/**" -> "^/blog/(.*)$"
 *      "/about" -> "^/about$"
 */
function routeToRegex(route: string): string {
  return (
    "^" +
    route.replace(/\*\*|\*|:[^/]+/g, (m) => {
      if (m === "**") return "(.*)";
      if (m === "*") return "([^/]+)";
      return "([^/]+)";
    }) +
    "$"
  );
}

export async function writeEdgeOneConfig(nitro: Nitro) {
  // Ensure routes are synced
  nitro.routing.sync();

  const config: EdgeOneConfig = {
    version: 3,
    routes: [],
  };

  // === Phase 1: Pre-processing routes (before filesystem) ===

  const rules = Object.entries(nitro.options.routeRules || {}).sort(
    (a, b) => a[0].split(/\/(?!\*)/).length - b[0].split(/\/(?!\*)/).length
  );

  // Redirect and header rules
  config.routes.push(
    ...rules
      .filter(([_, routeRules]) => routeRules.redirect || routeRules.headers)
      .map(([path, routeRules]) => {
        const route: SourceRoute = {
          src: routeToRegex(path),
        };
        if (routeRules.redirect) {
          route.status = routeRules.redirect.status || 302;
          route.headers = {
            Location: routeRules.redirect.to.replace("/**", "/$1"),
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

  // === Filesystem handler (dividing line) ===
  config.routes.push({ handle: "filesystem" });

  // === Phase 2: Origin routes (after filesystem) ===

  // 1. Collect all API routes (server-side route handlers)
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
      src: routeToRegex(route.path),
    };
    if (route.method !== "*") {
      sourceRoute.methods = [route.method.toUpperCase()];
    }
    config.routes.push(sourceRoute);
  }

  // 2. Collect SSR page routes (from framework like Nuxt)
  const ssrRoutes = [
    ...new Set([
      ...(nitro.options.ssrRoutes || []),
      ...[...nitro.scannedHandlers, ...nitro.options.handlers]
        .filter((h) => !h.middleware && h.route && h.route !== "/**")
        .map((h) => h.route!),
    ]),
  ];

  for (const route of ssrRoutes) {
    // Skip routes already added as API routes
    if (apiRoutes.some((r) => r.path === route)) {
      continue;
    }
    config.routes.push({
      src: routeToRegex(route),
    });
  }

  // 3. Add catch-all route (must be last)
  config.routes.push({
    src: "^/(.*)$",
  });

  // Write config.json to the server directory
  const configContent = JSON.stringify(config, null, 2);
  await writeFile(join(nitro.options.output.serverDir, "config.json"), configContent, true);

  // Return route information for debugging
  return {
    apiRoutes,
  };
}
