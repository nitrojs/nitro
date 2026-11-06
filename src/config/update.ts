import consola from "consola";
import type { Nitro, NitroDynamicConfig } from "nitro/types";
import { resolvePublicAssetsRouteRules } from "./resolvers/assets.ts";
import { normalizeRouteRules } from "./resolvers/route-rules.ts";
import { normalizeRuntimeConfig } from "./resolvers/runtime-config.ts";

export async function updateNitroConfig(nitro: Nitro, config: NitroDynamicConfig) {
  nitro.options.routeRules = normalizeRouteRules(config.routeRules ? config : nitro.options);
  resolvePublicAssetsRouteRules({
    routeRules: nitro.options.routeRules,
    publicAssets: nitro.options.publicAssets.map((asset) => ({ ...asset })),
  });
  nitro.options.runtimeConfig = normalizeRuntimeConfig(
    config.runtimeConfig ? config : nitro.options
  );
  await nitro.hooks.callHook("build:reload");
  consola.success("Nitro config hot reloaded!");
}
