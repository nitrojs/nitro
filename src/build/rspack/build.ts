import type { Nitro } from "nitro/types";
import { getRspackConfig } from "./config.ts";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function rspackBuild(nitro: Nitro) {
  await nitro.hooks.callHook("build:before", nitro);
  const config = await getRspackConfig(nitro);
  return nitro.options.dev ? watchDev(nitro, config) : buildProduction(nitro, config);
}
