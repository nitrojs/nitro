import type { Configuration } from "@rspack/core";
import type { Nitro } from "nitro/types";
import { importDep } from "../../utils/dep.ts";
import { getRspackConfig } from "./config.ts";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function rspackBuild(nitro: Nitro) {
  const rspack = await importDep({
    id: "@rspack/core",
    dir: nitro.options.rootDir,
    paths: nitro.options.deps?.paths,
  });
  await nitro.hooks.callHook("build:before", nitro);
  const config = await getRspackConfig(nitro, rspack);
  await nitro.hooks.callHook("build:config", nitro, { builder: "rspack", rspack: config });
  return nitro.options.dev
    ? watchDev(nitro, config as Configuration, rspack)
    : buildProduction(nitro, config as Configuration, rspack);
}
