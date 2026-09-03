import type { NitroApp, NitroRuntimeHooks, ResolvedRouteRules } from "nitro/types";
import type { ServerRequest, ServerRequestContext } from "srvx";
import type { ComposedMiddleware, H3EventContext, Middleware, WebSocketHooks } from "h3";
import { composeMiddleware, toRequest } from "h3";
import { HookableCore } from "hookable";
import { createMatcherFromFind, memoizeRouteRulesMatcher } from "h3/rules";

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
  req.context = { ...req.context, ...context } as ServerRequestContext;
  const appHandler = useNitroApp().fetch;
  try {
    return Promise.resolve(appHandler(req));
  } catch (error) {
    return Promise.reject(error);
  }
}

// crossws' wire format for handing WebSocket hooks off on the *request*, written
// by h3's `defineWebSocketHandler()`. Read as a bare registry symbol rather than
// via `getWebSocketHooks()` so core runtime keeps no import of `crossws`.
const kWebSocketHooks: unique symbol = /* @__PURE__ */ Symbol.for("crossws.hooks");

export async function resolveWebsocketHooks(req: ServerRequest): Promise<Partial<WebSocketHooks>> {
  // The `crossws` property on the response is best-effort only: any staged
  // response header (a `headers` route rule, CORS, ...) makes h3 rebuild the
  // response, and a rebuild carries none of the original's own properties.
  const res = (await serverFetch(req)) as { crossws?: Partial<WebSocketHooks> };
  const carrier = req as unknown as Record<symbol, Partial<WebSocketHooks> | undefined> & {
    context?: Record<symbol, Partial<WebSocketHooks> | undefined>;
  };
  return res.crossws ?? carrier[kWebSocketHooks] ?? carrier.context?.[kWebSocketHooks] ?? {};
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

let _matchRouteRules: ReturnType<typeof createMatcherFromFind> | undefined;

export function getRouteRules(
  method: string,
  pathname: string
): {
  routeRules: ResolvedRouteRules;
  routeRuleMiddleware: Middleware[];
} {
  return (_matchRouteRules ??= memoizeRouteRulesMatcher(createMatcherFromFind(findRouteRules)))(
    method,
    pathname
  );
}

/**
 * Middleware that runs the route-rule middleware (`redirect`, `headers`,
 * `cors`, ...) matched for the current request. The composed chain is cached
 * per memoized match, so each distinct match is composed once.
 *
 * `event.context.routeRules` is assigned earlier, from `~findRoute`, so it is
 * populated for every middleware regardless of its position in the chain.
 */
export function createRouteRulesMiddleware(): Middleware {
  const composed = new WeakMap<Middleware[], ComposedMiddleware>();
  const middleware: Middleware = (event, next) => {
    const ruleMiddleware = getRouteRules(event.req.method, event.url.pathname).routeRuleMiddleware;
    if (ruleMiddleware.length === 0) {
      return next();
    }
    let chain = composed.get(ruleMiddleware);
    if (!chain) {
      chain = composeMiddleware(ruleMiddleware);
      composed.set(ruleMiddleware, chain);
    }
    return chain(event, next as any);
  };
  return markUntraced(middleware);
}

/**
 * Middleware that runs the routed (`server/middleware/**` with a route)
 * middleware matched for the current request. Chains are cached by the identity
 * of the matched handlers (a trie keyed on the router's stable data slots), so
 * the cache is bounded by the number of distinct match combinations rather than
 * by request pathnames.
 */
export function createRoutedMiddleware(
  findRoutedMiddleware: (method: string, pathname: string) => { data: Middleware }[]
): Middleware {
  const root: RoutedChainNode = { children: new Map() };
  const middleware: Middleware = (event, next) => {
    const matched = findRoutedMiddleware(event.req.method, event.url.pathname);
    if (matched.length === 0) {
      return next();
    }
    let node = root;
    for (const entry of matched) {
      let child = node.children.get(entry);
      if (!child) {
        child = { children: new Map() };
        node.children.set(entry, child);
      }
      node = child;
    }
    return (node.chain ??= composeMiddleware(matched.map((r) => r.data)))(event, next as any);
  };
  return markUntraced(middleware);
}

type RoutedChainNode = {
  children: Map<object, RoutedChainNode>;
  chain?: ComposedMiddleware;
};

// Nitro's own wrappers are not user middleware: opt them out of `h3/tracing`
// so they do not add anonymous spans around the whole downstream chain.
function markUntraced(middleware: Middleware): Middleware {
  (middleware as Middleware & { __traced__?: boolean }).__traced__ = true;
  return middleware;
}
