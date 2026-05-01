import consola from "consola";
import type { Nitro, NitroDynamicConfig } from "nitro/types";
import { normalizeRouteRules } from "./resolvers/route-rules.ts";
import { normalizeRuntimeConfig } from "./resolvers/runtime-config.ts";

export async function updateNitroConfig(nitro: Nitro, config: NitroDynamicConfig) {
  nitro.options.routeRules = normalizeRouteRules(config.routeRules ? config : nitro.options);
  nitro.options.runtimeConfig = normalizeRuntimeConfig(
    config.runtimeConfig ? config : nitro.options
  );
  await nitro.hooks.callHook("rollup:reload");
  consola.success("Nitro config hot reloaded!");
}
