import type { Nitro } from "nitro/types";

export default function runtimeConfig(nitro: Nitro) {
  return {
    id: "#nitro-internal-virtual/runtime-config",
    template: () => {
      return /* js */ `export const runtimeConfig = ${JSON.stringify(
        nitro.options.runtimeConfig || {}
      )};`;
    },
  };
}
