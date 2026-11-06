import consola from "consola";
import type { Nitro, NitroDynamicConfig } from "nitro/types";
import { resolveClientAssetsRouteRules } from "../build/assets.ts";
import { resolvePublicAssetsRouteRules } from "./resolvers/assets.ts";
import { normalizeRouteRules } from "./resolvers/route-rules.ts";
import { normalizeRuntimeConfig } from "./resolvers/runtime-config.ts";

export async function updateNitroConfig(nitro: Nitro, config: NitroDynamicConfig) {
  nitro.options.routeRules = normalizeRouteRules(config.routeRules ? config : nitro.options);
  resolvePublicAssetsRouteRules({
    routeRules: nitro.options.routeRules,
    publicAssets: nitro.options.publicAssets.map((asset) => ({ ...asset })),
  });
  resolveClientAssetsRouteRules(nitro);
  nitro.options.runtimeConfig = normalizeRuntimeConfig({
    ...nitro.options,
    runtimeConfig: config.runtimeConfig || nitro.options.runtimeConfig,
  });
  await nitro.hooks.callHook("build:reload");
  consola.success("Nitro config hot reloaded!");
}
