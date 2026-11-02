import type { NitroApp, NitroRuntimeHooks, ResolvedRouteRules } from "nitro/types";
import type { ServerRequest, ServerRequestContext } from "srvx";
import type { ComposedMiddleware, H3EventContext, H3Route, Middleware, WebSocketHooks } from "h3";
import type { MatchedRoute } from "rou3";
import { composeMiddleware, HTTPError, toRequest } from "h3";
import { HookableCore } from "hookable";
import type { MatchedRouteRules } from "h3/rules";
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

export function useNitroHooks(): NonNullable<NitroApp["hooks"]> {
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

/**
 * Get the resolved route rules for a method and pathname.
 *
 * The result is memoized and shared, so treat it as read-only.
 */
export function getRouteRules(
  method: string,
  pathname: string
): { routeRules: ResolvedRouteRules } {
  return matchRouteRules(method, pathname);
}

/**
 * Middleware that runs the route-rule middleware (`redirect`, `headers`,
 * `cors`, ...) matched for the current request, except `cache` (see
 * `createCacheRuleMiddleware`). The composed chain is cached per memoized
 * match, so each distinct match is composed once.
 *
 * `event.context.routeRules` is assigned earlier, from `~findRoute`, so it is
 * populated for every middleware regardless of its position in the chain.
 */
export function createRouteRulesMiddleware(): Middleware {
  const middleware: Middleware = (event, next) => {
    const { rules, cache } = resolveRouteRuleChains(event.req.method, event.url.pathname);
    if (cache) {
      (event as CacheRuleCarrier)[kCacheRule] = cache;
    }
    return rules ? rules(event, next as any) : next();
  };
  return markUntraced(middleware);
}

/**
 * Middleware that runs the `cache` route rule matched for the current request.
 * The rule dispatches the matched route handler itself, so it is registered
 * after global and routed middleware for them to run on cached routes too.
 *
 * The rule is matched by `createRouteRulesMiddleware`, on the same pathname as
 * the other rules, even if a middleware rewrites `event.url` in between.
 */
export function createCacheRuleMiddleware(): Middleware {
  const middleware: Middleware = (event, next) => {
    const cache = (event as CacheRuleCarrier)[kCacheRule];
    return cache ? cache(event, next) : next();
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

// `~findRoute` fallback: `405` with an `Allow` header when the path is routed
// only for other `methods` (a method-agnostic route would have matched already).
export function createMethodNotAllowedMatcher(
  findRoute: (method: string, pathname: string) => unknown,
  methods: string[]
): (method: string, pathname: string) => MatchedRoute<H3Route> | undefined {
  return (method, pathname) => {
    let allow: string | undefined;
    for (const m of methods) {
      if (m !== method && findRoute(m, pathname)) {
        allow = allow ? `${allow}, ${m}` : m;
      }
    }
    if (!allow) {
      return;
    }
    // Returned rather than thrown: h3 handles it the same, without the unwinding cost
    return {
      data: {
        handler: () =>
          new HTTPError({
            status: 405,
            statusText: "Method Not Allowed",
            message: `Method ${method} is not allowed for ${pathname} (allowed: ${allow})`,
            headers: { allow },
          }),
      },
    };
  };
}

let _matchRouteRules: ReturnType<typeof createMatcherFromFind> | undefined;

function matchRouteRules(
  method: string,
  pathname: string
): {
  routeRules: ResolvedRouteRules;
  matchedRules: MatchedRouteRules;
  routeRuleMiddleware: Middleware[];
} {
  return (_matchRouteRules ??= memoizeRouteRulesMatcher(createMatcherFromFind(findRouteRules)))(
    method,
    pathname
  );
}

const kCacheRule: unique symbol = /* @__PURE__ */ Symbol("nitro.cacheRule");

type CacheRuleCarrier = { [kCacheRule]?: Middleware };

const _routeRuleChains = /* @__PURE__ */ new WeakMap<Middleware[], RouteRuleChains>();

function resolveRouteRuleChains(method: string, pathname: string): RouteRuleChains {
  const { matchedRules, routeRuleMiddleware } = matchRouteRules(method, pathname);
  if (routeRuleMiddleware.length === 0) {
    return {};
  }
  let chains = _routeRuleChains.get(routeRuleMiddleware);
  if (!chains) {
    // `cache` has the highest `order` of the rule handlers, so it is always last
    const hasCache = !!matchedRules.cache?.handler;
    const rules = hasCache ? routeRuleMiddleware.slice(0, -1) : routeRuleMiddleware;
    chains = {
      rules: rules.length > 0 ? composeMiddleware(rules) : undefined,
      cache: hasCache ? routeRuleMiddleware.at(-1) : undefined,
    };
    _routeRuleChains.set(routeRuleMiddleware, chains);
  }
  return chains;
}

type RouteRuleChains = {
  rules?: ComposedMiddleware;
  cache?: Middleware;
};

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
