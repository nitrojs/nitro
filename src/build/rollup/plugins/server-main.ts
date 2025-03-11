import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";

export function serverMain(nitro: Nitro): Plugin {
  return {
    name: "nitro:server-main",
    renderChunk(code, chunk) {
      if (chunk.isEntry) {
        return {
          code: `globalThis.__nitro_main__ = import.meta.url; ${code}`,
          map: null,
        };
      }
    },
  };
}
