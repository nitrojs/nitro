import type {
  CaptureError,
  MatchedRouteRules,
  NitroApp,
  NitroAsyncContext,
  NitroRuntimeHooks,
} from "nitro/types";
import type { ServerRequest } from "srvx";
import type { H3Config, Middleware } from "h3";
import { H3Core, toRequest } from "h3";
import { HookableCore } from "hookable";
import { nitroAsyncContext } from "./context";

// IMPORTANT: virtuals and user code should be imported last to avoid initialization order issues
import errorHandler from "#nitro-internal-virtual/error-handler";
import { plugins } from "#nitro-internal-virtual/plugins";
import {
  hasRouteRules,
  findRoute,
  findRouteRules,
  globalMiddleware,
  findRoutedMiddleware,
  hasRoutedMiddleware,
  hasGlobalMiddleware,
  hasRoutes,
} from "#nitro-internal-virtual/routing";

export function useNitroApp(): NitroApp {
  return ((useNitroApp as any).__instance__ ??= initNitroApp());
}

function initNitroApp(): NitroApp {
  const nitroApp = createNitroApp();
  for (const plugin of plugins) {
    try {
      plugin(nitroApp);
    } catch (error: any) {
      nitroApp.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
  return nitroApp;
}

function createNitroApp(): NitroApp {
  const hooks = new HookableCore<NitroRuntimeHooks>();

  const captureError: CaptureError = (error, errorCtx) => {
    const promise = hooks
      .callHook("error", error, errorCtx)
      ?.catch?.((hookError: any) => {
        console.error("Error while capturing another error", hookError);
      });
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.nitro?.errors;
      if (errors) {
        errors.push({ error, context: errorCtx });
      }
      if (typeof errorCtx.event.req.waitUntil === "function") {
        errorCtx.event.req.waitUntil(promise);
      }
    }
  };

  const h3App = createH3App({
    onError(error, event) {
      captureError(error, { event });
      return errorHandler(error, event);
    },
    onRequest(event) {
      return hooks.callHook("request", event)?.catch?.((error: any) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onResponse(res, event) {
      return hooks.callHook("response", res, event)?.catch?.((error: any) => {
        captureError(error, { event, tags: ["response"] });
      });
    },
  });

  let fetchHandler = (req: ServerRequest): Response | Promise<Response> => {
    req.context ??= {};
    req.context.nitro = req.context.nitro || { errors: [] };
    return h3App.fetch(req);
  };

  // Experimental async context support
  if (import.meta._asyncContext) {
    const originalFetchHandler = fetchHandler;
    fetchHandler = (req: ServerRequest): Promise<Response> => {
      const asyncCtx: NitroAsyncContext = { request: req as Request };
      return nitroAsyncContext.callAsync(asyncCtx, () =>
        originalFetchHandler(req)
      );
    };
  }

  const requestHandler: (
    input: ServerRequest | URL | string,
    init?: RequestInit,
    context?: any
  ) => Promise<Response> = (input, init, context) => {
    const req = toRequest(input, init);
    req.context = { ...req.context, ...context };
    return Promise.resolve(fetchHandler(req));
  };

  const originalFetch = globalThis.fetch;
  const nitroFetch = (input: RequestInfo, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return requestHandler(input, init);
    }
    if (input instanceof Request && "_request" in input) {
      input = (input as any)._request;
    }
    return originalFetch(input, init);
  };

  // @ts-ignore
  globalThis.fetch = nitroFetch;

  const app: NitroApp = {
    _h3: h3App,
    hooks,
    fetch: requestHandler,
    captureError,
  };

  return app;
}

function createH3App(config: H3Config) {
  // Create H3 app
  const h3App = new H3Core(config);

  // Compiled route matching
  hasRoutes &&
    (h3App["~findRoute"] = (event) =>
      findRoute(event.req.method, event.url.pathname));

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
        middleware.push(
          ...findRoutedMiddleware(method!, pathname!).map((r) => r.data)
        );
      if (hasRoutes && route?.data?.middleware?.length) {
        middleware.push(...route.data.middleware);
      }
      return middleware;
    };
  }

  return h3App;
}

function getRouteRules(
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
        if (
          typeof currentRule.options === "object" &&
          typeof rule.options === "object"
        ) {
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
