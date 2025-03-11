import { getRolldownConfig } from "./config";
import type { Nitro } from "nitro/types";
import { watchDev } from "./dev";
import { buildProduction } from "./prod";

export async function rolldownBuild(nitro: Nitro) {
  await nitro.hooks.callHook("build:before", nitro);
  const config = getRolldownConfig(nitro);
  await nitro.hooks.callHook("rollup:before", nitro, config as any);
  return nitro.options.dev
    ? watchDev(nitro, config)
    : buildProduction(nitro, config);
}
