import type { Nitro } from "nitro/types";

export default function featureFlags(nitro: Nitro) {
  return {
    id: "#nitro-internal-virtual/feature-flags",
    template: () => {
      const featureFlags: Record<string, boolean> = {
        // Routing
        hasRoutes: nitro.routing.routes.hasRoutes(),
        hasRouteRules: nitro.routing.routeRules.hasRoutes(),
        hasRoutedMiddleware: nitro.routing.routedMiddleware.hasRoutes(),
        hasGlobalMiddleware: nitro.routing.globalMiddleware.length > 0,
        // Plugins
        hasPlugins: nitro.options.plugins.length > 0,
        hasHooks:
          nitro.options.features?.runtimeHooks ??
          nitro.options.plugins.length > 0,
        // Features
        hasWebSocket:
          nitro.options.features?.websocket ??
          nitro.options.experimental.websocket ??
          false,
      };
      return /* js */ Object.entries(featureFlags)
        .map(
          ([key, value]) => /* js */ `export const ${key} = ${Boolean(value)};`
        )
        .join("\n");
    },
  };
}
