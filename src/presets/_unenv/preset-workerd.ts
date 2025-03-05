import type { Preset } from "unenv";
import type { Plugin } from "rollup";

import { fileURLToPath } from "mlly";
import { join } from "pathe";

import { builtnNodeModules, hybridNodeModules } from "./node-compat/cloudflare";

const workerdDir = fileURLToPath(new URL("workerd/", import.meta.url));
const resolvePresetRuntime = (m: string) => join(workerdDir, `${m}.mjs`);

export const unenvCfExternals: Preset = {
  meta: {
    name: "nitro-cloudflare:externals",
    url: import.meta.url,
  },
  external: [
    "cloudflare:email",
    "cloudflare:sockets",
    "cloudflare:workers",
    "cloudflare:workflows",
  ],
};

export const unenvWorkerdWithNodeCompat: Preset = {
  meta: {
    name: "nitro-cloudflare:node-compat",
    url: import.meta.url,
  },
  external: builtnNodeModules.map((m) => `node:${m}`),
  alias: {
    // (native)
    ...Object.fromEntries(
      builtnNodeModules.flatMap((m) => [
        [m, `node:${m}`],
        [`node:${m}`, `node:${m}`],
      ])
    ),
    // (hybrid)
    ...Object.fromEntries(
      hybridNodeModules.flatMap((m) => {
        const resolved = resolvePresetRuntime(m);
        return [
          [`node:${m}`, resolved],
          [m, resolved],
        ];
      })
    ),
  },
};

export const workerdHybridNodeCompatPlugin: Plugin = {
  name: "nitro:cloudflare:hybrid-node-compat",
  resolveId(id) {
    if (id.startsWith("cloudflare:")) {
      return { id, external: true, moduleSideEffects: false };
    }
    if (id.startsWith("#workerd/node:")) {
      return {
        id: id.slice("#workerd/".length),
        external: true,
        moduleSideEffects: false,
      };
    }
    if (id.startsWith(workerdDir)) {
      return { id, moduleSideEffects: false };
    }
  },
};
