import type { MatchedRouteRules, NitroApp, NitroRuntimeHooks } from "nitro/types";
import type { ServerPlugin, ServerRequest, ServerRequestContext } from "srvx";
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

export const nitroRuntimeHooksPlugin: ServerPlugin = (server) => {
  const close = server.close.bind(server);
  let closeHooksPromise: Promise<unknown> | undefined;
  server.close = async (...args) => {
    closeHooksPromise ||= Promise.resolve(useNitroHooks().callHook("close"));
    await closeHooksPromise;
    await close(...args);
  };
};

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
  const rawLayers = findRouteRules(method, pathname);

  // An encoded separator must not let a request dodge a rule it would still hit
  // once the downstream decodes `%2f`/`%5c` back to `/` — e.g. `/app/admin%2fpanel`
  // is served by a broad rule on the raw path but canonicalizes to
  // `/app/admin/panel`, which a narrower (auth) rule guards (GHSA-5w89-w975-hf9q).
  // So also match on the canonical path.
  const canonical = canonicalPath(pathname);
  const canonicalLayers = canonical === pathname ? undefined : findRouteRules(method, canonical);

  if (!rawLayers?.length && !canonicalLayers?.length) {
    return { routeRuleMiddleware: [] };
  }

  // Resolve each path independently so a rule's `false` reset only affects the
  // path it is configured for, then union the two: a rule applies if the served
  // (raw) or the decoded (canonical) path enables it. The canonical pass can only
  // add or override — never delete — a rule the served path resolved, so an
  // encoded separator can neither dodge a rule nor strip one off the path that is
  // actually served. On overlap the more-specific canonical rule wins (e.g. the
  // `/app/admin/**` auth gate over a broad `/app/**` rule for `/app/admin%2fpanel`).
  // Proxy/redirect still forward the raw `event.url.pathname`.
  const routeRules = mergeRouteRules(rawLayers);
  if (canonicalLayers?.length) {
    const canonicalRules = mergeRouteRules(canonicalLayers);
    for (const name in canonicalRules) {
      mergeRouteRule(routeRules, canonicalRules[name], canonicalRules[name].params);
    }
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

// Merge the matched route layers (least → most specific) of a single path into a
// set of route rules. Resolve each path (raw / canonical) with its own call so a
// `false` reset never leaks across paths.
function mergeRouteRules(layers: any): MatchedRouteRules {
  const routeRules: MatchedRouteRules = {};
  for (const layer of layers || []) {
    for (const rule of layer.data) {
      mergeRouteRule(routeRules, rule, layer.params);
    }
  }
  return routeRules;
}

// Apply one rule (a matched layer or a resolved rule from the other path) onto
// the accumulated set. `false` resets an inherited rule; otherwise options are
// merged (objects) or overridden, with the incoming — more specific or later —
// rule winning.
function mergeRouteRule(routeRules: MatchedRouteRules, rule: any, params: any): void {
  const currentRule = routeRules[rule.name];
  if (currentRule) {
    if (rule.options === false) {
      // Remove/Reset existing rule with `false` value
      delete routeRules[rule.name];
      return;
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
    currentRule.params = { ...currentRule.params, ...params };
  } else if (rule.options !== false) {
    routeRules[rule.name] = { ...rule, params };
  }
}
