import type { Nitro } from "nitro/types";

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
