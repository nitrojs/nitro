import consola from "consola";
import type { Nitro, NitroDynamicConfig } from "nitropack/types";
import { resolvePublicAssetsRouteRules } from "./resolvers/assets";
import { normalizeRouteRules } from "./resolvers/route-rules";
import { normalizeRuntimeConfig } from "./resolvers/runtime-config";

export async function updateNitroConfig(
  nitro: Nitro,
  config: NitroDynamicConfig
) {
  nitro.options.routeRules = normalizeRouteRules(
    config.routeRules ? config : nitro.options
  );
  resolvePublicAssetsRouteRules({
    routeRules: nitro.options.routeRules,
    publicAssets: nitro.options.publicAssets.map((asset) => ({ ...asset })),
  });
  nitro.options.runtimeConfig = normalizeRuntimeConfig(
    config.runtimeConfig ? config : nitro.options
  );
  await nitro.hooks.callHook("rollup:reload");
  consola.success("Nitro config hot reloaded!");
}
