import type { Nitro } from "nitro/types";

/**
 * Create a virtual server-entry module reflecting Nitro's configured server entry handler.
 *
 * @param nitro - Nitro configuration object used to determine the server entry handler
 * @returns An object with `id` set to the virtual module id `#nitro-internal-virtual/server-entry` and `template` containing `export * from "<handler>"` when a handler is configured, otherwise `export {}`.
 */
export default function serverEntry(nitro: Nitro) {
  if (nitro.options.serverEntry && nitro.options.serverEntry.handler) {
    return {
      id: "#nitro-internal-virtual/server-entry",
      template: `export * from "${nitro.options.serverEntry.handler}";`,
    };
  }

  return {
    id: "#nitro-internal-virtual/server-entry",
    template: "export {}",
  };
}
