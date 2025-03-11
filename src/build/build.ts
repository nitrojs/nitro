import { getRollupConfig } from "./rollup/config";
import type { Nitro } from "nitro/types";
import { watchDev } from "./dev";
import { buildProduction } from "./prod";

export async function build(nitro: Nitro) {
  await nitro.hooks.callHook("build:before", nitro);
  const rollupConfig = getRollupConfig(nitro);
  await nitro.hooks.callHook("rollup:before", nitro, rollupConfig);
  return nitro.options.dev
    ? watchDev(nitro, rollupConfig)
    : buildProduction(nitro, rollupConfig);
}
