import type { PresetEnv } from "../../../build/env.ts";
import * as denoCompat from "./node-compat.ts";

// https://platform-node-compat.deno.dev/
// https://platform-node-compat.netlify.app/

export const unenvDeno: PresetEnv = {
  builtinModules: denoCompat.builtnNodeModules,
  alias: {
    ...Object.fromEntries(
      denoCompat.builtnNodeModules.flatMap((m) => [
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
    performance: false, // Native
  },
};
