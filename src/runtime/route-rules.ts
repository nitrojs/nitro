import {
  eventHandler,
  H3Event,
  sendRedirect,
  setHeaders,
  proxyRequest,
} from "h3";
import defu from "defu";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import { joinURL, withoutBase } from "ufo";
import { useRuntimeConfig } from "./config";
import type { NitroRouteRules } from "nitropack";

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRadixRouter({ routes: config.nitro.routeRules })
);

export function createRouteRulesHandler() {
  return eventHandler((event) => {
    // Match route options against path
    const routeRules = getRouteRules(event);
    // Apply headers options
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    // Apply redirect options
    if (routeRules.redirect) {
      return sendRedirect(
        event,
        routeRules.redirect.to,
        routeRules.redirect.statusCode
      );
    }
    // Apply proxy options
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        target = joinURL(target.slice(0, -3), event.path);
      }
      return proxyRequest(event, target, {
        fetch: $fetch.raw as any,
        ...routeRules.proxy,
      });
    }
  });
}

export function getRouteRules(event: H3Event): NitroRouteRules {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    const path = new URL(event.node.req.url, "http://localhost").pathname;
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(path, useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}

export function getRouteRulesForPath(path: string): NitroRouteRules {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}
