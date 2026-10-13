import type { Nitro } from "nitro/types";

const nitroInstances: Nitro[] = ((globalThis as any).__nitro_instances__ ||= []);

const globalKey = "__nitro_builder__";

declare global {
  var __nitro_builder__: {
    fetch: (req: Request) => Promise<Response>;
  };
}

export function registerNitroInstance(nitro: Nitro) {
  if (nitroInstances.includes(nitro)) {
    return;
  }
  globalInit();
  nitroInstances.unshift(nitro);
  nitro.hooks.hookOnce("close", () => {
    nitroInstances.splice(nitroInstances.indexOf(nitro), 1);
    if (nitroInstances.length === 0) {
      delete (globalThis as any)[globalKey];
    }
  });
}

function globalInit() {
  if (globalThis[globalKey]) {
    return;
  }
  globalThis[globalKey] = {
    async fetch(req) {
      for (let r = 0; r < 10 && nitroInstances.length === 0; r++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const nitro = nitroInstances[0];
      if (!nitro) {
        throw new Error("No Nitro instance is running.");
      }
      return nitro.fetch(req);
    },
  };
}
