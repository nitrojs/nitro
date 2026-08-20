import type { NitroApp, NitroRuntimeHooks, ResolvedRouteRules } from "nitro/types";
import type { ServerRequest, ServerRequestContext } from "srvx";
import type { H3EventContext, Middleware, WebSocketHooks } from "h3";
import { toRequest } from "h3";
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
