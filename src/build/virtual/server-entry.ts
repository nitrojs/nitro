import type { Nitro } from "nitro/types";

export const serverEntry = (nitro: Nitro) => {
  if (nitro.options.serverEntry) {
    return {
      id: "#nitro-internal-virtual/server-entry",
      template: `export * from "${nitro.options.serverEntry.handler}";`,
    };
  }

  return {
    id: "#nitro-internal-virtual/server-entry",
    template: "export {}",
  };
};
