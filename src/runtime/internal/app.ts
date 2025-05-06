import destr from "destr";
import {
  type H3Error,
  type H3Event,
  createApp,
  createRouter,
  eventHandler,
  fetchWithEvent,
  isEvent,
  lazyEventHandler,
  toNodeListener,
} from "h3";
import { createHooks } from "hookable";
import type {
  CaptureError,
  NitroApp,
  NitroRuntimeHooks,
} from "nitropack/types";
import type { NitroAsyncContext } from "nitropack/types";
import { Headers, createFetch } from "ofetch";
import {
  fetchNodeRequestHandler,
  callNodeRequestHandler,
  type AbstractRequest,
} from "node-mock-http";
import { cachedEventHandler } from "./cache";
import { useRuntimeConfig } from "./config";
import { nitroAsyncContext } from "./context";
import { createRouteRulesHandler, getRouteRulesForPath } from "./route-rules";
import { normalizeFetchResponse } from "./utils";

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

  const h3App = createApp({
    debug: destr(process.env.DEBUG),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error as H3Error, event);
    },
    onRequest: async (event) => {
      // Init nitro context
      event.context.nitro = event.context.nitro || { errors: [] };

      // Support platform context provided by local fetch
      const fetchContext = (event.node.req as any)?.__unenv__ as
        | undefined
        | {
            waitUntil?: H3Event["waitUntil"];
            _platform?: Record<string, any>;
          };
      if (fetchContext?._platform) {
        event.context = {
          _platform: fetchContext?._platform, // #3335
          ...fetchContext._platform,
          ...event.context,
        };
      }
      if (!event.context.waitUntil && fetchContext?.waitUntil) {
        event.context.waitUntil = fetchContext.waitUntil;
      }

      // Assign bound fetch to context
      event.fetch = (req, init) =>
        fetchWithEvent(event, req, init, { fetch: localFetch });
      event.$fetch = (req, init) =>
        fetchWithEvent(event, req, init as RequestInit, {
          fetch: $fetch as any,
        });

      // https://github.com/nitrojs/nitro/issues/1420
      event.waitUntil = (promise) => {
        if (!event.context.nitro._waitUntilPromises) {
          event.context.nitro._waitUntilPromises = [];
        }
        event.context.nitro._waitUntilPromises.push(promise);
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
    onAfterResponse: async (event, response) => {
      await nitroApp.hooks
        .callHook("afterResponse", event, response)
        .catch((error) => {
          captureError(error, { event, tags: ["request", "response"] });
        });
    },
  });

  const router = createRouter({
    preemptive: true,
  });

  // Create local fetch caller
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest: AbstractRequest) =>
    callNodeRequestHandler(nodeHandler, aRequest);
  const localFetch: typeof fetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return fetchNodeRequestHandler(
      nodeHandler,
      input as string /* TODO */,
      init
    ).then((response) => normalizeFetchResponse(response));
  };
  const $fetch = createFetch({
    fetch: localFetch,
    Headers,
    defaults: { baseURL: config.app.baseURL },
  });

  // @ts-ignore
  globalThis.$fetch = $fetch;

  // Register route rule handlers
  h3App.use(createRouteRulesHandler({ localFetch }));

  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(
        /\/+/g,
        "/"
      );
      h3App.use(middlewareBase, handler);
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
      router.use(h.route, handler, h.method);
    }
  }

  h3App.use(config.app.baseURL as string, router.handler);

  // Experimental async context support
  if (import.meta._asyncContext) {
    const _handler = h3App.handler;
    h3App.handler = (event) => {
      const ctx: NitroAsyncContext = { event };
      return nitroAsyncContext.callAsync(ctx, () => _handler(event));
    };
  }

  const app: NitroApp = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch,
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
