import type { PresetEnv } from "../../../build/env.ts";
import * as bunnyCompat from "./node-compat.ts";

export const unenvBunny: PresetEnv = {
  builtinModules: bunnyCompat.builtinNodeModules,
  alias: {
    ...Object.fromEntries(
      bunnyCompat.builtinNodeModules.flatMap((m) => [
        [m, m],
        [m.replace("node:", ""), m],
      ])
    ),
  },
  inject: {
    global: "#nitro/runtime/polyfills/globalthis",
    process: "node:process",
    clearImmediate: ["node:timers", "clearImmediate"],
    setImmediate: ["node:timers", "setImmediate"],
    Buffer: ["node:buffer", "Buffer"],
    // Bunny provides `BroadcastChannel` as a global. Without this the `nodeless`
    // preset maps it to `node:worker_threads`, which Bunny cannot resolve.
    BroadcastChannel: false,
  },
};
