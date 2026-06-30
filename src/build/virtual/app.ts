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
      const hasGetMiddleware = hasRouteRules || hasRoutedMiddleware;
      const hasAsyncContext = !!nitro.options.experimental.asyncContext;

      const routingImports = [
        hasRoutes && "findRoute",
        hasRoutedMiddleware && "findRoutedMiddleware",
        hasGlobalMiddleware && "globalMiddleware",
      ].filter(Boolean);

      const imports: string[] = [];
      const code: string[] = [];

      imports.push(
        `import { H3Core } from "h3";`,
        `import errorHandler from "#nitro/virtual/error-handler";`
      );

      // --- createNitroApp() ---

      code.push(``, `export function createNitroApp() {`);

      if (hasHooks) {
        imports.push(`import { HookableCore } from "hookable";`);
        code.push(`  const hooks = new HookableCore();`);
      }

      code.push(``, `const captureError = (error, errorCtx) => {`);
      if (hasHooks) {
        code.push(
          `    const promise = hooks.callHook("error", error, errorCtx)?.catch?.((hookError) => {`,
          `      console.error("Error while capturing another error", hookError);`,
          `    });`
        );
      }
      code.push(
        `    if (errorCtx?.event) {`,
        `      const errors = errorCtx.event.req.context?.nitro?.errors;`,
        `      if (errors) {`,
        `        errors.push({ error, context: errorCtx });`,
        `      }`
      );
      if (hasHooks) {
        code.push(
          `      if (promise && typeof errorCtx.event.req.waitUntil === "function") {`,
          `        errorCtx.event.req.waitUntil(promise);`,
          `      }`
        );
      }
      code.push(`    }`, `  };`);

      code.push(``, `  const h3App = createH3App({`, `    onError(error, event) {`);
      if (hasHooks) {
        code.push(`      captureError(error, { event });`);
      }
      code.push(`      return errorHandler(error, event);`, `    },`, `  });`);

      if (hasHooks) {
        code.push(
          ``,
          `  h3App.config.onRequest = (event) => {`,
          `    return hooks.callHook("request", event)?.catch?.((error) => {`,
          `      captureError(error, { event, tags: ["request"] });`,
          `    });`,
          `  };`,
          `  h3App.config.onResponse = (res, event) => {`,
          `    return hooks.callHook("response", res, event)?.catch?.((error) => {`,
          `      captureError(error, { event, tags: ["response"] });`,
          `    });`,
          `  };`
        );
      }

      code.push(
        ``,
        `  let appHandler = (req) => {`,
        `    req.context ||= {};`,
        `    req.context.nitro = req.context.nitro || { errors: [] };`,
        `    return h3App.fetch(req);`,
        `  };`
      );

      if (hasAsyncContext) {
        imports.push(`import { nitroAsyncContext } from "#nitro/runtime/context";`);
        code.push(
          ``,
          `  const originalHandler = appHandler;`,
          `  appHandler = (req) => {`,
          `    return nitroAsyncContext.callAsync({ request: req }, () => originalHandler(req));`,
          `  };`
        );
      }

      code.push(
        ``,
        `  return {`,
        `    fetch: appHandler,`,
        `    h3: h3App,`,
        `    hooks: ${hasHooks ? "hooks" : "undefined"},`,
        `    captureError,`,
        `  };`,
        `}`
      );

      // --- initNitroPlugins() ---

      code.push(``, `export function initNitroPlugins(app) {`);
      if (hasPlugins) {
        imports.push(`import { plugins } from "#nitro/virtual/plugins";`);
        code.push(
          `  for (const plugin of plugins) {`,
          `    try {`,
          `      plugin(app);`,
          `    } catch (error) {`,
          `      app.captureError?.(error, { tags: ["plugin"] });`,
          `      throw error;`,
          `    }`,
          `  }`
        );
      }
      code.push(`  return app;`, `}`);

      // --- createH3App() ---

      if (routingImports.length) {
        imports.push(`import { ${routingImports.join(", ")} } from "#nitro/virtual/routing";`);
      }

      code.push(``, `function createH3App(config) {`, `  const h3App = new H3Core(config);`);
      if (hasRoutes) {
        code.push(
          `  h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);`
        );
      }
      if (hasGlobalMiddleware) {
        code.push(`  h3App["~middleware"].push(...globalMiddleware);`);
      }
      if (hasGetMiddleware) {
        code.push(
          `  h3App["~getMiddleware"] = (event, route) => {`,
          `    const pathname = event.url.pathname;`,
          `    const method = event.req.method;`,
          `    const middleware = [];`
        );
        if (hasRouteRules) {
          imports.push(`import { getRouteRules } from "#nitro/runtime/app";`);
          code.push(
            `    const routeRules = getRouteRules(method, pathname);`,
            `    event.context.routeRules = routeRules?.routeRules;`,
            `    if (routeRules?.routeRuleMiddleware.length) {`,
            `      middleware.push(...routeRules.routeRuleMiddleware);`,
            `    }`
          );
        }
        if (hasGlobalMiddleware) {
          code.push(`    middleware.push(...h3App["~middleware"]);`);
        }
        if (hasRoutedMiddleware) {
          code.push(
            `    middleware.push(...findRoutedMiddleware(method, pathname).map((r) => r.data));`
          );
        }
        if (hasRoutes) {
          code.push(
            `    if (route?.data?.middleware?.length) {`,
            `      middleware.push(...route.data.middleware);`,
            `    }`
          );
        }
        code.push(`    return middleware;`, `  };`);
      }
      code.push(`  return h3App;`, `}`);

      return [...imports, ...code].join("\n");
    },
  };
}
