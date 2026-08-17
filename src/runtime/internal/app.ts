import type { MatchedRouteRules, NitroApp, NitroRuntimeHooks } from "nitro/types";
import type { ServerPlugin, ServerRequest, ServerRequestContext } from "srvx";
import type { H3EventContext, Middleware, WebSocketHooks } from "h3";
import { toRequest } from "h3";
import { HookableCore } from "hookable";
import { createMatcherFromFind, memoizeRouteRulesMatcher } from "h3-rules";

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
    closeHooksPromise ||= Promise.resolve()
      .then(() => useNitroHooks().callHook("close"))
      .catch((error) => {
        console.error("Error while running Nitro close hooks", error);
      });
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

let _matchRouteRules: ReturnType<typeof createMatcherFromFind> | undefined;

export function getRouteRules(
  method: string,
  pathname: string
): {
  routeRules: MatchedRouteRules;
  routeRuleMiddleware: Middleware[];
} {
  return (_matchRouteRules ??= memoizeRouteRulesMatcher(createMatcherFromFind(findRouteRules)))(
    method,
    pathname
  );
}
