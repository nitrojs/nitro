import type { PresetEnv } from "../../_utils/env.ts";
import * as workerdNodeCompat from "./node-compat.ts";

// https://platform-node-compat.pi0.workers.dev/

export const unenvCfNodeCompat: PresetEnv = {
  external: workerdNodeCompat.builtnNodeModules,
  alias: {
    ...Object.fromEntries(
      workerdNodeCompat.builtnNodeModules.flatMap((m) => [
        [m, m],
        [m.replace("node:", ""), m],
      ])
    ),
  },
  inject: {
    global: "unenv/polyfill/globalthis",
    process: "node:process",
    clearImmediate: ["node:timers", "clearImmediate"],
    setImmediate: ["node:timers", "setImmediate"],
    Buffer: ["node:buffer", "Buffer"],
  },
};

export const unenvCfExternals: PresetEnv = {
  external: [
    "cloudflare:email",
    "cloudflare:sockets",
    "cloudflare:workers",
    "cloudflare:workflows",
  ],
};
