import type { Nitro } from "nitro/types";
import { virtual } from "./virtual.ts";

export function featureFlags(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/feature-flags": () => {
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
        };
        return /* js */ Object.entries(featureFlags)
          .map(
            ([key, value]) =>
              /* js */ `export const ${key} = ${Boolean(value)};`
          )
          .join("\n");
      },
    },
    nitro.vfs
  );
}
