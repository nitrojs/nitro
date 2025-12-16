import type { Preset } from "unenv";
import * as denoCompat from "./node-compat.ts";

// https://platform-node-compat.deno.dev/
// https://platform-node-compat.netlify.app/

export const unenvDeno: Preset = {
  meta: {
    name: "nitro:deno",
  },
  external: denoCompat.builtnNodeModules.map((m) => `node:${m}`),
  alias: {
    ...Object.fromEntries(
      denoCompat.builtnNodeModules.flatMap((m) => [
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
