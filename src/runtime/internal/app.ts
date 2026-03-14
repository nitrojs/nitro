import type {
  CaptureError,
  MatchedRouteRules,
  NitroApp,
  NitroAsyncContext,
  NitroRuntimeHooks,
} from "nitro/types";
import type { ServerRequest, ServerRequestContext } from "srvx";
import type { H3Config, H3EventContext, Middleware, WebSocketHooks } from "h3";
import { H3Core, toRequest } from "h3";
import { HookableCore } from "hookable";
import { nitroAsyncContext } from "./context.ts";

// IMPORTANT: virtual imports and user code should be imported last to avoid initialization order issues
import errorHandler from "#nitro/virtual/error-handler";
import { plugins } from "#nitro/virtual/plugins";
import {
  findRoute,
  findRouteRules,
  globalMiddleware,
  findRoutedMiddleware,
} from "#nitro/virtual/routing";
import {
  hasRouteRules,
  hasRoutedMiddleware,
  hasGlobalMiddleware,
  hasRoutes,
  hasHooks,
  hasPlugins,
} from "#nitro/virtual/feature-flags";

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
  if (hasPlugins) {
    initNitroPlugins(instance);
  }
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
  return fetch(resource, init);
}

function createNitroApp(): NitroApp {
  const hooks = hasHooks ? new HookableCore<NitroRuntimeHooks>() : undefined;

  const captureError: CaptureError = (error, errorCtx) => {
    const promise =
      hasHooks &&
      hooks!.callHook("error", error, errorCtx)?.catch?.((hookError: any) => {
        console.error("Error while capturing another error", hookError);
      });
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.nitro?.errors;
      if (errors) {
        errors.push({ error, context: errorCtx });
      }
      if (hasHooks && promise && typeof errorCtx.event.req.waitUntil === "function") {
        errorCtx.event.req.waitUntil(promise);
      }
    }
  };

  const h3App = createH3App({
    onError(error, event) {
      hasHooks && captureError(error, { event });
      return errorHandler(error, event);
    },
  });

  if (hasHooks) {
    h3App.config.onRequest = (event) => {
      return hooks!.callHook("request", event)?.catch?.((error: any) => {
        captureError(error, { event, tags: ["request"] });
      });
    };
    h3App.config.onResponse = (res, event) => {
      return hooks!.callHook("response", res, event)?.catch?.((error: any) => {
        captureError(error, { event, tags: ["response"] });
      });
    };
  }

  let appHandler = (req: ServerRequest): Response | Promise<Response> => {
    req.context ||= {};
    req.context.nitro = req.context.nitro || { errors: [] };
    return h3App.fetch(req);
  };

  // Experimental async context support
  if (import.meta._asyncContext) {
    const originalHandler = appHandler;
    appHandler = (req: ServerRequest): Promise<Response> => {
      const asyncCtx: NitroAsyncContext = { request: req as Request };
      return nitroAsyncContext.callAsync(asyncCtx, () => originalHandler(req));
    };
  }

  const app: NitroApp = {
    fetch: appHandler,
    h3: h3App,
    hooks,
    captureError,
  };

  return app;
}

function initNitroPlugins(app: NitroApp) {
  for (const plugin of plugins) {
    try {
      plugin(app as NitroApp & { hooks: NonNullable<NitroApp["hooks"]> });
    } catch (error: any) {
      app.captureError?.(error, { tags: ["plugin"] });
      throw error;
    }
  }
  return app;
}

function createH3App(config: H3Config) {
  // Create H3 app
  const h3App = new H3Core(config);

  // Compiled route matching
  hasRoutes && (h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname));

  hasGlobalMiddleware && h3App["~middleware"].push(...globalMiddleware);

  if (hasRouteRules || hasRoutedMiddleware) {
    h3App["~getMiddleware"] = (event, route) => {
      const needsRouting = hasRouteRules || hasRoutedMiddleware;
      const pathname = needsRouting ? event.url.pathname : undefined;
      const method = needsRouting ? event.req.method : undefined;
      const middleware: Middleware[] = [];
      if (hasRouteRules) {
        const routeRules = getRouteRules(method!, pathname!);
        event.context.routeRules = routeRules?.routeRules;
        if (routeRules?.routeRuleMiddleware.length) {
          middleware.push(...routeRules.routeRuleMiddleware);
        }
      }
      hasGlobalMiddleware && middleware.push(...h3App["~middleware"]);
      hasRoutedMiddleware &&
        middleware.push(...findRoutedMiddleware(method!, pathname!).map((r) => r.data));
      if (hasRoutes && route?.data?.middleware?.length) {
        middleware.push(...route.data.middleware);
      }
      return middleware;
    };
  }

  return h3App;
}

export function getRouteRules(
  method: string,
  pathname: string
): {
  routeRules?: MatchedRouteRules;
  routeRuleMiddleware: Middleware[];
} {
  const m = findRouteRules(method, pathname);
  if (!m?.length) {
    return { routeRuleMiddleware: [] };
  }
  const routeRules: MatchedRouteRules = {};
  for (const layer of m) {
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
  const middleware = [];
  for (const rule of Object.values(routeRules)) {
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
