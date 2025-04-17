import destr from "destr";
import type { H3Error, H3EventContext } from "h3";
import { H3, fetchWithEvent, isEvent, lazyEventHandler } from "h3";
import { createHooks } from "hookable";
import type { CaptureError, NitroApp, NitroRuntimeHooks } from "nitro/types";
import type { NitroAsyncContext } from "nitro/types";
import { Headers, createFetch } from "ofetch";
import { cachedEventHandler } from "./cache";
import { useRuntimeConfig } from "./config";
import { nitroAsyncContext } from "./context";
import { createRouteRulesHandler, getRouteRulesForPath } from "./route-rules";

// IMPORTANT: virtuals and user code should be imported last to avoid initialization order issues
import errorHandler from "#nitro-internal-virtual/error-handler";
import { plugins } from "#nitro-internal-virtual/plugins";
import { handlers } from "#nitro-internal-virtual/server-handlers";

function createNitroApp(): NitroApp {
  const config = useRuntimeConfig();

  const hooks = createHooks<NitroRuntimeHooks>();

  const captureError: CaptureError = (error, context = {}) => {
    const promise = hooks
      .callHookParallel("error", error, context)
      .catch((error_) => {
        console.error("Error while capturing another error", error_);
      });
    if (context.event && isEvent(context.event)) {
      const errors = context.event.context.nitro?.errors;
      if (errors) {
        errors.push({ error, context });
      }
      if (context.event.waitUntil) {
        context.event.waitUntil(promise);
      }
    }
  };

  const h3App = new H3({
    debug: destr(process.env.DEBUG),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error as H3Error, event);
    },
    onRequest: async (event) => {
      event.context.nitro = event.context.nitro || { errors: [] };

      // Add platform context provided by local fetch
      if (event.context._platform) {
        Object.assign(event.context, event.context._platform);
      }

      // Assign bound fetch to context
      event.fetch = (req, init) =>
        fetchWithEvent(event, req, init, { fetch: appFetch });

      event.$fetch = (req, init) =>
        fetchWithEvent(event, req, init as RequestInit, {
          fetch: $fetch as any,
        });

      event.waitUntil = (promise) => {
        if (!event.context.nitro!._waitUntilPromises) {
          event.context.nitro!._waitUntilPromises = [];
        }
        event.context.nitro!._waitUntilPromises.push(promise);
        if (event.context.waitUntil) {
          event.context.waitUntil(promise);
        }
      };

      event.captureError = (error, context) => {
        captureError(error, { event, ...context });
      };

      await nitroApp.hooks.callHook("request", event).catch((error) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onBeforeResponse: async (event, response) => {
      await nitroApp.hooks
        .callHook("beforeResponse", event, response)
        .catch((error) => {
          captureError(error, { event, tags: ["request", "response"] });
        });
    },
  });

  const appFetch = (
    input: string | URL | Request,
    init?: RequestInit,
    ctx?: H3EventContext
  ) => {
    return Promise.resolve(h3App.fetch(input, init, ctx));
  };

  const hybridFetch: typeof fetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return appFetch(input, init);
  };

  const $fetch = createFetch({
    fetch: hybridFetch,
    Headers,
    defaults: { baseURL: config.app.baseURL },
  });

  // @ts-ignore
  globalThis.$fetch = $fetch;

  // Register route rule handlers
  h3App.use(createRouteRulesHandler(hybridFetch));

  // TODO support baseURL

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

  // Experimental async context support
  if (import.meta._asyncContext) {
    const _fetch = h3App.fetch;
    h3App.fetch = (request, init) => {
      const ctx: NitroAsyncContext = { request: request as any };
      return nitroAsyncContext.callAsync(ctx, () => _fetch(request, init));
    };
  }

  const app: NitroApp = {
    hooks,
    h3App,
    fetch: appFetch,
    captureError,
  };

  return app;
}

function runNitroPlugins(nitroApp: NitroApp) {
  for (const plugin of plugins) {
    try {
      plugin(nitroApp);
    } catch (error: any) {
      nitroApp.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
}

export const nitroApp: NitroApp = createNitroApp();

export function useNitroApp() {
  return nitroApp;
}

runNitroPlugins(nitroApp);
