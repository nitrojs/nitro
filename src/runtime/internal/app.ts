import type { ServerRequest } from "srvx";
import type {
  CaptureError,
  NitroApp,
  NitroAsyncContext,
  NitroRuntimeHooks,
} from "nitro/types";

import { H3, lazyEventHandler, toRequest } from "h3";
import type { HTTPEvent } from "h3";
import { createFetch } from "ofetch";
import { cachedEventHandler } from "./cache";
import { createRouteRulesHandler, getRouteRulesForPath } from "./route-rules";

// IMPORTANT: virtuals and user code should be imported last to avoid initialization order issues
import errorHandler from "#nitro-internal-virtual/error-handler";
import { plugins } from "#nitro-internal-virtual/plugins";
import { handlers } from "#nitro-internal-virtual/server-handlers";
import { createHooks } from "hookable";
import { nitroAsyncContext } from "./context";

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
  const h3App = new H3({
    debug: DEBUG_MODE,
    onError: (error, event) => {
      captureError(error, {
        event,
        tags: ["request"],
      });
      return errorHandler(error, event);
    },
  });

  // Register route rule handlers
  h3App.use(createRouteRulesHandler());

  // Register server handlers
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (!h.route) {
      h3App.use(handler);
    } else if (h.middleware) {
      h3App.use(h.route, handler, { method: h.method });
    } else {
      const routeRules = getRouteRulesForPath(
        h.route.replace(/:\w+|\*\*/g, "_")
      );
      if (routeRules.cache) {
        handler = cachedEventHandler(handler, {
          group: "nitro/routes",
          ...routeRules.cache,
        });
      }
      h3App.on(h.method, h.route, handler);
    }
  }

  return h3App;
}
