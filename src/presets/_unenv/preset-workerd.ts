import type { Preset } from "unenv";

import { fileURLToPath } from "mlly";

import { builtnNodeModules } from "./node-compat/cloudflare";

const workerdDir = fileURLToPath(new URL("workerd/", import.meta.url));

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
    ...Object.fromEntries(
      builtnNodeModules.flatMap((m) => [
        [m, `node:${m}`],
        [`node:${m}`, `node:${m}`],
      ])
    ),
  },
};
