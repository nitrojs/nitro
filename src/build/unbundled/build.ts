import type { Nitro } from "nitro/types";
import { watchDev } from "./dev.ts";

export async function unbundledBuild(nitro: Nitro) {
  assertUnbundledSupport(nitro);
  await nitro.hooks.callHook("build:before", nitro);
  return watchDev(nitro);
}

/** Throw for what `builder: false` does not support yet (production builds). */
export function assertUnbundledSupport(nitro: Nitro) {
  if (!nitro.options.dev) {
    throw new Error(
      "Production builds are not supported with `builder: false` yet. Set `builder` to `rolldown`, `rollup` or `vite` to build."
    );
  }
}
