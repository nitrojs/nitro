import { runtimeDir } from "nitro/meta";
import type { NitroOptions } from "nitro/types";
import { join } from "pathe";

export async function resolveOpenAPIOptions(options: NitroOptions) {
  // Check if the experimental.openAPI option is enabled
  if (!options.experimental.openAPI) {
    return;
  }

  // Only enable for dev and (opt-in) production
  if (!options.dev && !options.openAPI?.production) {
    return;
  }

  const shouldPrerender = !options.dev && options.openAPI?.production === "prerender";

  const handlersEnv = shouldPrerender ? "prerender" : "";

  const prerenderRoutes: string[] = [];

  // Add openapi json route
  const jsonRoute = options.openAPI?.route || "/_openapi.json";
  prerenderRoutes.push(jsonRoute);
  options.handlers.push({
    route: jsonRoute,
    env: handlersEnv,
    handler: join(runtimeDir, "internal/routes/openapi"),
  });

  // Scalar UI
  if (options.openAPI?.ui?.scalar !== false) {
    const scalarRoute = options.openAPI?.ui?.scalar?.route || "/_scalar";
    prerenderRoutes.push(scalarRoute);
    options.handlers.push({
      route: options.openAPI?.ui?.scalar?.route || "/_scalar",
      env: handlersEnv,
      handler: join(runtimeDir, "internal/routes/scalar"),
    });
  }

  // Swagger UI
  if (options.openAPI?.ui?.swagger !== false) {
    const swaggerRoute = options.openAPI?.ui?.swagger?.route || "/_swagger";
    prerenderRoutes.push(swaggerRoute);
    options.handlers.push({
      route: swaggerRoute,
      env: handlersEnv,
      handler: join(runtimeDir, "internal/routes/swagger"),
    });
  }

  // Prerender
  if (shouldPrerender) {
    options.prerender ??= {} as any;
    options.prerender.routes ??= [];
    options.prerender.routes.push(...prerenderRoutes);
  }
}
