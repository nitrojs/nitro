import type { Preset } from "unenv";
import * as bunnyCompat from "./node-compat.ts";

export const unenvBunny: Preset = {
  meta: {
    name: "nitro:bunny",
  },
  external: bunnyCompat.builtinNodeModules,
  alias: {
    ...Object.fromEntries(
      bunnyCompat.builtinNodeModules.flatMap((m) => [
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
    // Bunny provides `BroadcastChannel` as a global. Without this the `nodeless`
    // preset maps it to `node:worker_threads`, which Bunny cannot resolve.
    BroadcastChannel: false,
  },
};
