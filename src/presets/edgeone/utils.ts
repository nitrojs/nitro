import type { Nitro } from "nitro/types";
import fsp from "node:fs/promises";
import { relative, dirname, join } from "pathe";
import consola from "consola";
import { colors } from "consola/utils";
interface FrameworkRoute {
  path: string;
  isStatic?: boolean;
  isr?: number;
}

export async function writeEdgeOneRoutes(nitro: Nitro) {
  // Ensure routes are synced
  nitro.routing.sync();
  const meta = {
    conf: {
      ssr404: true,
    },
    frameworkRoutes: [] as FrameworkRoute[],
  };

  // 1. Get all API routes (server-side route handlers)
  const apiRoutes = nitro.routing.routes.routes
    .filter((route) => {
      // Filter out middleware and wildcard routes (e.g., /**)
      const handler = Array.isArray(route.data) ? route.data[0] : route.data;
      return handler && !handler.middleware && route.route !== "/**";
    })
    .map((route) => ({
      path: route.route,
      method: route.method || "*",
      handler: Array.isArray(route.data) ? route.data[0] : route.data,
    }));
  for (const route of apiRoutes) {
    meta.frameworkRoutes.push({
      path: route.path,
    });
  }

  // 2. Get all page routes (prerendered routes)
  const pageRoutes = (nitro._prerenderedRoutes || []).map((route) => ({
    path: route.route,
    fileName: route.fileName,
    contentType: route.contentType,
  }));

  // 3. Get user-defined prerender routes
  const userPrerenderRoutes = nitro.options.prerender?.routes || [];
  // 4. Get all routes marked as prerender in route rules
  const prerenderRouteRules = Object.entries(nitro.options.routeRules || {})
    .filter(([_, rules]) => rules.prerender)
    .map(([path]) => path);

  // 5. Get all routes with SWR/cache settings from route rules
  // Note: `swr: true` shortcut is normalized to `cache: { swr: true }` after config resolution
  const swrRouteRules = Object.entries(nitro.options.routeRules || {})
    .filter(([_, rules]) => {
      // Check if cache.swr is enabled (normalized form)
      if (rules.cache && typeof rules.cache === "object" && rules.cache.swr) {
        return true;
      }
      return false;
    })
    .map(([path, rules]) => ({
      path,
      cache: rules.cache as { swr?: boolean; maxAge?: number },
    }));
  for (const route of swrRouteRules) {
    const maxAge = route.cache.maxAge;
    for (const frameworkRoute of meta.frameworkRoutes) {
      if (frameworkRoute.path === route.path) {
        Reflect.set(frameworkRoute, "isStatic", false);
        Reflect.set(frameworkRoute, "isr", maxAge);
      }
    }
  }

  // Merge all prerender routes
  const allPrerenderRoutes = [
    ...new Set([
      ...userPrerenderRoutes,
      ...prerenderRouteRules,
      ...pageRoutes.map((r) => r.path),
    ]),
  ];
  for (const route of allPrerenderRoutes) {
    meta.frameworkRoutes.push({
      path: route,
      isStatic: true,
    });
  }

  await writeFile(
    join(nitro.options.output.dir, "meta.json"),
    JSON.stringify(meta, null, 2)
  );
  await writeFile(
    join(nitro.options.output.serverDir, "meta.json"),
    JSON.stringify(meta, null, 2)
  );

  // Return all route information
  return {
    apiRoutes,
    pageRoutes,
    userPrerenderRoutes,
    prerenderRouteRules,
    allPrerenderRoutes,
    swrRouteRules,
  };
}

function prettyPath(p: string, highlight = true) {
  p = relative(process.cwd(), p);
  return highlight ? colors.cyan(p) : p;
}

async function writeFile(file: string, contents: Buffer | string, log = false) {
  await fsp.mkdir(dirname(file), { recursive: true });
  await fsp.writeFile(
    file,
    contents,
    typeof contents === "string" ? "utf8" : undefined
  );
  if (log) {
    consola.info("Generated", prettyPath(file));
  }
}
