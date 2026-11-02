import defu from "defu";
import {
  type H3Event,
  createError,
  eventHandler,
  proxyRequest,
  sendRedirect,
  setHeaders,
} from "h3";
import type { NitroRouteRules } from "nitropack/types";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import { getQuery, joinURL, withQuery, withoutBase } from "ufo";
import { useRuntimeConfig } from "./config";
import {
  isPathInScope,
  isTargetInScope,
  resolveRedirectTarget,
} from "./route-rules-utils";

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRadixRouter({ routes: config.nitro.routeRules })
);

export function createRouteRulesHandler(ctx: {
  localFetch: typeof globalThis.fetch;
}) {
  return eventHandler((event) => {
    // Match route options against path
    const routeRules = getRouteRules(event);
    // Apply headers options
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    // Apply redirect options
    if (routeRules.redirect) {
      const target = resolveRedirectTarget(
        event.path,
        routeRules.redirect.to,
        (routeRules.redirect as any)._redirectStripBase
      );
      if (target === undefined) {
        throw createError({ statusCode: 400 });
      }
      return sendRedirect(event, target, routeRules.redirect.statusCode);
    }
    // Apply proxy options
    if (routeRules.proxy) {
      const target = resolveRuleTarget(
        event,
        routeRules.proxy.to,
        (routeRules.proxy as any)._proxyStripBase
      );
      return proxyRequest(event, target, {
        fetch: ctx.localFetch,
        ...routeRules.proxy,
      });
    }
  });
}

function resolveRuleTarget(
  event: H3Event,
  to: string,
  stripBase: string | undefined
): string {
  if (!to.endsWith("/**")) {
    if (event.path.includes("?")) {
      return withQuery(to, getQuery(event.path));
    }
    return to;
  }
  const targetBase = to.slice(0, -3);
  let targetPath = event.path;
  if (stripBase) {
    if (!isPathInScope(event.path.split("?")[0], stripBase)) {
      throw createError({ statusCode: 400 });
    }
    targetPath = withoutBase(targetPath, stripBase);
  } else if (targetPath.startsWith("//")) {
    targetPath = targetPath.replace(/^\/+/, "/");
  }
  const target = joinURL(targetBase, targetPath);
  // Validate the final target, not only the incoming path
  if (!isTargetInScope(target, targetBase)) {
    throw createError({ statusCode: 400 });
  }
  return target;
}

export function getRouteRules(event: H3Event): NitroRouteRules {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.path.split("?")[0], useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}

// prettier-ignore
type DeepReadonly<T> = T extends Record<string, any>
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T;

/**
 * @param path - The path to match against route rules. This should not contain a query string.
 */
export function getRouteRulesForPath(
  path: string
): DeepReadonly<NitroRouteRules> {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}
