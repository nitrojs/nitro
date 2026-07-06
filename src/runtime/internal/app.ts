import type { MatchedRouteRules, NitroApp, NitroRuntimeHooks } from "nitro/types";
import type { ServerRequest, ServerRequestContext } from "srvx";
import type { H3EventContext, Middleware, WebSocketHooks } from "h3";
import { toRequest } from "h3";
import { HookableCore } from "hookable";

import { canonicalPath } from "./route-rules.ts";

// IMPORTANT: virtual imports and user code should be imported last to avoid initialization order issues
import { findRouteRules } from "#nitro/virtual/routing";
import { createNitroApp, initNitroPlugins } from "#nitro/virtual/app";

declare global {
  var __nitro__:
    | Partial<Record<"default" | "prerender" | (string & {}), NitroApp | undefined>>
    | undefined;
}

const APP_ID = import.meta.prerender ? "prerender" : "default";

export function useNitroApp(): NitroApp {
  let instance: NitroApp | undefined = (useNitroApp as any)._instance;
  if (instance) {
    return instance;
  }
  instance = (useNitroApp as any)._instance = createNitroApp();
  globalThis.__nitro__ = globalThis.__nitro__ || {};
  globalThis.__nitro__[APP_ID] = instance;
  initNitroPlugins(instance);
  return instance;
}

export function useNitroHooks(): HookableCore<NitroRuntimeHooks> {
  const nitroApp = useNitroApp();
  const hooks = nitroApp.hooks;
  if (hooks) {
    return hooks;
  }
  return (nitroApp.hooks = new HookableCore<NitroRuntimeHooks>());
}

export function serverFetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: ServerRequestContext | H3EventContext
): Promise<Response> {
  const req = toRequest(resource, init);
  req.context = { ...req.context, ...context };
  const appHandler = useNitroApp().fetch;
  try {
    return Promise.resolve(appHandler(req));
  } catch (error) {
    return Promise.reject(error);
  }
}

export async function resolveWebsocketHooks(req: ServerRequest): Promise<Partial<WebSocketHooks>> {
  // https://github.com/h3js/h3/blob/c11ca743d476e583b3b47de1717e6aae92114357/src/utils/ws.ts#L37
  const hooks = ((await serverFetch(req)) as any).crossws as Partial<WebSocketHooks>;
  return hooks || {};
}

export function fetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: ServerRequestContext | H3EventContext
): Promise<Response> {
  if (typeof resource === "string" && resource.charCodeAt(0) === 47) {
    return serverFetch(resource, init, context);
  }
  resource = (resource as any)._request || resource; // unwrap srvx request
  return globalThis.fetch(resource, init);
}

export function getRouteRules(
  method: string,
  pathname: string
): {
  routeRules?: MatchedRouteRules;
  routeRuleMiddleware: Middleware[];
} {
  // h3 routes the served handler/middleware on the raw `pathname` (`%2f`/`%5c`
  // stay opaque), so the rules the raw path matches describe the handler that
  // actually runs and must all apply.
  const routeRules = mergeRouteRules(findRouteRules(method, pathname));

  // An encoded separator must not let a request dodge a rule it would still hit
  // once the downstream decodes `%2f`/`%5c` back to `/` — e.g. `/secure%2fpage`
  // is served by a broad proxy rule on the raw path but canonicalizes to
  // `/secure/page`, which a narrower (auth) rule guards (GHSA-5w89-w975-hf9q).
  // So also apply any rule the canonical path matches that the raw path missed.
  // Rules the raw path already matched win (they target the served handler);
  // the canonical pass only fills in what would otherwise be dodged.
  const canonical = canonicalPath(pathname);
  if (canonical !== pathname) {
    const canonicalRules = mergeRouteRules(findRouteRules(method, canonical));
    for (const name in canonicalRules) {
      routeRules[name] ??= canonicalRules[name];
    }
  }

  if (Object.keys(routeRules).length === 0) {
    return { routeRuleMiddleware: [] };
  }
  const middleware = [];
  const orderedRules = Object.values(routeRules).sort(
    (a, b) => (a.handler?.order || 0) - (b.handler?.order || 0)
  );
  for (const rule of orderedRules) {
    if (rule.options === false || !rule.handler) {
      continue;
    }
    middleware.push(rule.handler(rule));
  }
  return {
    routeRules,
    routeRuleMiddleware: middleware,
  };
}

// Merge the matched route layers (least → most specific) into a single set of
// route rules, with more-specific options merged in and `false` resetting a
// rule inherited from a less-specific layer.
function mergeRouteRules(layers: any): MatchedRouteRules {
  const routeRules: MatchedRouteRules = {};
  for (const layer of layers || []) {
    for (const rule of layer.data) {
      const currentRule = routeRules[rule.name];
      if (currentRule) {
        if (rule.options === false) {
          // Remove/Reset existing rule with `false` value
          delete routeRules[rule.name];
          continue;
        }
        if (typeof currentRule.options === "object" && typeof rule.options === "object") {
          // Merge nested rule objects
          currentRule.options = { ...currentRule.options, ...rule.options };
        } else {
          // Override rule if non object
          currentRule.options = rule.options;
        }
        // Routing (route and params)
        currentRule.route = rule.route;
        currentRule.params = { ...currentRule.params, ...layer.params };
      } else if (rule.options !== false) {
        routeRules[rule.name] = { ...rule, params: layer.params };
      }
    }
  }
  return routeRules;
}
