import type { Nitro } from "nitro/types";
import { getBunConfig } from "./config.ts";
import { assertBunRuntime } from "./_runtime.ts";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function bunBuild(nitro: Nitro) {
  assertBunRuntime();
  await nitro.hooks.callHook("build:before", nitro);
  const { config, container } = await getBunConfig(nitro);
  await nitro.hooks.callHook("build:config", nitro, { builder: "bun", bun: config });
  return nitro.options.dev
    ? watchDev(nitro, config, container)
    : buildProduction(nitro, config, container);
}
