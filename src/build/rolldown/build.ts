import { getRolldownConfig } from "./config.ts";
import type { Nitro } from "nitro/types";
import { importRolldown } from "./_import.ts";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function rolldownBuild(nitro: Nitro) {
  // Installed on demand before the config, so its build plugins use the `rolldown` oxc bindings
  const rolldown = await importRolldown(nitro.options.rootDir, {
    deps: nitro.options.deps,
  });
  await nitro.hooks.callHook("build:before", nitro);
  const config = await getRolldownConfig(nitro);
  await nitro.hooks.callHook("build:config", nitro, { builder: "rolldown", rolldown: config });
  return nitro.options.dev
    ? watchDev(nitro, config, rolldown)
    : buildProduction(nitro, config, rolldown);
}
