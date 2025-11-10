import type { Nitro } from "nitro/types";
import { virtual } from "./virtual.ts";

export function runtimeConfig(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/runtime-config": () => {
        return `export const runtimeConfig = ${JSON.stringify(
          nitro.options.runtimeConfig || {}
        )};`;
      },
    },
    nitro.vfs
  );
}
