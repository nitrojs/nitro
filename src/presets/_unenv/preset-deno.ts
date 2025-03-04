import type { Preset } from "unenv";
import { builtnNodeModules } from "./node-compat/deno";

// https://platform-node-compat.deno.dev/
// https://platform-node-compat.netlify.app/

export const unenvDenoPreset: Preset = {
  external: builtnNodeModules.map((m) => `node:${m}`),
  alias: {
    // (native)
    ...Object.fromEntries(
      [...builtnNodeModules, "sys"].flatMap((m) => [
        [m, `node:${m}`],
        [`node:${m}`, `node:${m}`],
      ])
    ),
  },
  inject: {
    performance: false,
  },
};
