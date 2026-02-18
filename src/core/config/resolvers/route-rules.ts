import { defu } from "defu";
import type {
  NitroConfig,
  NitroOptions,
  NitroRouteConfig,
  NitroRouteRules,
} from "nitropack/types";
import { joinURL, withLeadingSlash } from "ufo";

export async function resolveRouteRulesOptions(options: NitroOptions) {
  // Backward compatibility for options.routes
  options.routeRules = defu(options.routeRules, (options as any).routes || {});

  options.routeRules = normalizeRouteRules(options);
}

export function normalizeRouteRules(
  config: NitroConfig
): Record<string, NitroRouteRules> {
  const normalizedRules: Record<string, NitroRouteRules> = {};
  for (let path in config.routeRules) {
    const routeConfig = config.routeRules[path] as NitroRouteConfig;
    path = withLeadingSlash(path);
    const routeRules: NitroRouteRules = {
      ...routeConfig,
      redirect: undefined,
      proxy: undefined,
    };
    // Redirect
    if (routeConfig.redirect) {
      routeRules.redirect = {
        // @ts-ignore
        to: "/",
        statusCode: 307,
        ...(typeof routeConfig.redirect === "string"
          ? { to: routeConfig.redirect }
          : routeConfig.redirect),
      };
      if (path.endsWith("/**")) {
        // Internal flag
        (routeRules.redirect as any)._redirectStripBase = config.baseURL
          ? joinURL(config.baseURL, path.slice(0, -3))
          : path.slice(0, -3);
      }
    }
    // Proxy
    if (routeConfig.proxy) {
      routeRules.proxy =
        typeof routeConfig.proxy === "string"
          ? { to: routeConfig.proxy }
          : routeConfig.proxy;
      if (path.endsWith("/**")) {
        // Internal flag
        (routeRules.proxy as any)._proxyStripBase = config.baseURL
          ? joinURL(config.baseURL, path.slice(0, -3))
          : path.slice(0, -3);
      }
    }
    // CORS
    if (routeConfig.cors) {
      routeRules.headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "*",
        "access-control-allow-headers": "*",
        "access-control-max-age": "0",
        ...routeRules.headers,
      };
    }
    // Cache: swr
    if (routeConfig.swr) {
      routeRules.cache = routeRules.cache || {};
      routeRules.cache.swr = true;
      if (typeof routeConfig.swr === "number") {
        routeRules.cache.maxAge = routeConfig.swr;
      }
    }
    // Cache: false
    if (routeConfig.cache === false) {
      routeRules.cache = false;
    }
    normalizedRules[path] = routeRules;
  }
  return normalizedRules;
}
