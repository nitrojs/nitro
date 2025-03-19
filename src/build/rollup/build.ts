import { getRollupConfig } from "./config";
import type { Nitro } from "nitro/types";
import { watchDev } from "./dev";
import { buildProduction } from "./prod";

export async function rollupBuild(nitro: Nitro) {
  await nitro.hooks.callHook("build:before", nitro);
  const config = getRollupConfig(nitro);
  await nitro.hooks.callHook("rollup:before", nitro, config);
  return nitro.options.dev
    ? watchDev(nitro, config)
    : buildProduction(nitro, config);
}
