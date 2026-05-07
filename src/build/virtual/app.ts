import type { Nitro } from "nitro/types";

export default function app(nitro: Nitro) {
  return {
    id: "#nitro/virtual/app",
    template: () => {
      const hasRoutes = nitro.routing.routes.hasRoutes();
      const hasRouteRules = nitro.routing.routeRules.hasRoutes();
      const hasRoutedMiddleware = nitro.routing.routedMiddleware.hasRoutes();
      const hasGlobalMiddleware = nitro.routing.globalMiddleware.length > 0;
      const hasPlugins = nitro.options.plugins.length > 0;
      const hasHooks = nitro.options.features?.runtimeHooks ?? hasPlugins;

      const routingImports = [
        hasRoutes && "findRoute",
        hasRoutedMiddleware && "findRoutedMiddleware",
        hasGlobalMiddleware && "globalMiddleware",
      ].filter(Boolean);

      return /* js */ `
import { H3Core } from "h3";
${hasHooks ? `import { HookableCore } from "hookable";` : ""}
import errorHandler from "#nitro/virtual/error-handler";
${hasPlugins ? `import { plugins } from "#nitro/virtual/plugins";` : ""}
${routingImports.length ? `import { ${routingImports.join(", ")} } from "#nitro/virtual/routing";` : ""}
${hasRouteRules ? `import { getRouteRules } from "#nitro/runtime/app";` : ""}
import { nitroAsyncContext } from "#nitro/runtime/context";

export function createNitroApp() {
  ${hasHooks ? `const hooks = new HookableCore();` : ""}

  const captureError = (error, errorCtx) => {
    ${
      hasHooks
        ? `const promise = hooks.callHook("error", error, errorCtx)?.catch?.((hookError) => {
      console.error("Error while capturing another error", hookError);
    });`
        : ""
    }
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.nitro?.errors;
      if (errors) {
        errors.push({ error, context: errorCtx });
      }
      ${
        hasHooks
          ? `if (promise && typeof errorCtx.event.req.waitUntil === "function") {
        errorCtx.event.req.waitUntil(promise);
      }`
          : ""
      }
    }
  };

  const h3App = createH3App({
    onError(error, event) {
      ${hasHooks ? `captureError(error, { event });` : ""}
      return errorHandler(error, event);
    },
  });

  ${
    hasHooks
      ? `h3App.config.onRequest = (event) => {
    return hooks.callHook("request", event)?.catch?.((error) => {
      captureError(error, { event, tags: ["request"] });
    });
  };
  h3App.config.onResponse = (res, event) => {
    return hooks.callHook("response", res, event)?.catch?.((error) => {
      captureError(error, { event, tags: ["response"] });
    });
  };`
      : ""
  }

  let appHandler = (req) => {
    req.context ||= {};
    req.context.nitro = req.context.nitro || { errors: [] };
    return h3App.fetch(req);
  };

  if (import.meta._asyncContext) {
    const originalHandler = appHandler;
    appHandler = (req) => {
      return nitroAsyncContext.callAsync({ request: req }, () => originalHandler(req));
    };
  }

  return {
    fetch: appHandler,
    h3: h3App,
    hooks: ${hasHooks ? `hooks` : `undefined`},
    captureError,
  };
}

export function initNitroPlugins(app) {
  ${
    hasPlugins
      ? `for (const plugin of plugins) {
    try {
      plugin(app);
    } catch (error) {
      app.captureError?.(error, { tags: ["plugin"] });
      throw error;
    }
  }`
      : ""
  }
  return app;
}

function createH3App(config) {
  const h3App = new H3Core(config);
  ${hasRoutes ? `h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);` : ""}
  ${hasGlobalMiddleware ? `h3App["~middleware"].push(...globalMiddleware);` : ""}
  ${
    hasRouteRules || hasRoutedMiddleware
      ? `h3App["~getMiddleware"] = (event, route) => {
    const pathname = event.url.pathname;
    const method = event.req.method;
    const middleware = [];
    ${
      hasRouteRules
        ? `const routeRules = getRouteRules(method, pathname);
    event.context.routeRules = routeRules?.routeRules;
    if (routeRules?.routeRuleMiddleware.length) {
      middleware.push(...routeRules.routeRuleMiddleware);
    }`
        : ""
    }
    ${hasGlobalMiddleware ? `middleware.push(...h3App["~middleware"]);` : ""}
    ${hasRoutedMiddleware ? `middleware.push(...findRoutedMiddleware(method, pathname).map((r) => r.data));` : ""}
    ${
      hasRoutes
        ? `if (route?.data?.middleware?.length) {
      middleware.push(...route.data.middleware);
    }`
        : ""
    }
    return middleware;
  };`
      : ""
  }
  return h3App;
}
`;
    },
  };
}
