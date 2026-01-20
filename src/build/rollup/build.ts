import { getRollupConfig } from "./config.ts";
import type { Nitro } from "nitro/types";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function rollupBuild(nitro: Nitro) {
  await nitro.hooks.callHook("build:before", nitro);
  const config = await getRollupConfig(nitro);
  await nitro.hooks.callHook("rollup:before", nitro, config);
  return nitro.options.dev
    ? watchDev(nitro, config)
    : buildProduction(nitro, config);
}
