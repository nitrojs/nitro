import type { ServerRequest } from "srvx";
import type {
  CaptureError,
  MatchedRouteRules,
  NitroApp,
  NitroAsyncContext,
  NitroRuntimeHooks,
} from "nitro/types";
import { H3Core, toRequest } from "h3";
import type { HTTPEvent, Middleware } from "h3";
import { createFetch } from "ofetch";

// IMPORTANT: virtuals and user code should be imported last to avoid initialization order issues
import errorHandler from "#nitro-internal-virtual/error-handler";
import { plugins } from "#nitro-internal-virtual/plugins";
import { createHooks } from "hookable";
import { nitroAsyncContext } from "./context";
import {
  findRoute,
  findRouteRules,
  middleware,
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
  const hooks = createHooks<NitroRuntimeHooks>();

  const captureError: CaptureError = (error, errorCtx) => {
    const promise = hooks
      .callHookParallel("error", error, errorCtx)
      .catch((hookError) => {
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

  const h3App = createH3App(captureError);

  let fetchHandler = async (req: ServerRequest): Promise<Response> => {
    req.context ??= {};
    req.context.nitro = req.context.nitro || { errors: [] };
    const event = { req } satisfies HTTPEvent;

    const nitroApp = useNitroApp();

    await nitroApp.hooks.callHook("request", event).catch((error) => {
      captureError(error, { event, tags: ["request"] });
    });

    const response = await h3App.request(req, undefined, req.context);

    await nitroApp.hooks
      .callHook("response", response, event)
      .catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });

    return response;
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

  const $fetch = createFetch({
    fetch: (input, init) => {
      if (!input.toString().startsWith("/")) {
        return globalThis.fetch(input, init);
      }
      return requestHandler(input, init);
    },
  });

  // @ts-ignore
  globalThis.$fetch = $fetch;

  const app: NitroApp = {
    _h3: h3App,
    hooks,
    fetch: requestHandler,
    captureError,
  };

  return app;
}

function createH3App(captureError: CaptureError) {
  const DEBUG_MODE = ["1", "true", "TRUE"].includes(process.env.DEBUG + "");

  const h3App = new H3Core({
    debug: DEBUG_MODE,
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error, event);
    },
  });

  // Middleware
  const globalMiddleware: Middleware[] = [];
  for (const mw of middleware) {
    if (!mw.method && (!mw.route || mw.route === "/**")) {
      globalMiddleware.push(mw.handler);
    } else {
      // TODO: Should migrate to compiled pattern matching for right ordering
      h3App.use(mw.route || "/**", mw.handler, { method: mw.method });
    }
  }

  // Compiled route matching
  h3App._getMiddleware = (event, route) => {
    const pathname = event.url.pathname;
    const method = event.req.method.toLowerCase();
    const { routeRules, routeRuleMiddleware } = getRouteRules(method, pathname);
    event.context.routeRules = routeRules;
    return [
      ...(routeRuleMiddleware || []),
      ...globalMiddleware,
      ...(route?.data.middleware || []),
    ];
  };
  h3App._findRoute = (event) => {
    const pathname = event.url.pathname;
    const method = event.req.method.toLowerCase();
    return findRoute(method, pathname);
  };

  return h3App;
}

function getRouteRules(
  method: string,
  pathname: string
): {
  routeRules?: MatchedRouteRules;
  routeRuleMiddleware?: Middleware[];
} {
  const m = findRouteRules(method, pathname);
  if (!m?.length) {
    return {};
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
    routeRuleMiddleware: middleware.length > 0 ? middleware : undefined,
  };
}
