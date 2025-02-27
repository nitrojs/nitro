import type { Preset } from "unenv";
import type { Plugin } from "rollup";

import { fileURLToPath } from "mlly";
import { join } from "pathe";

import { builtnNodeModules } from "./node-compat/deno";

const presetRuntimeDir = fileURLToPath(new URL("runtime/", import.meta.url));
const resolvePresetRuntime = (m: string) => join(presetRuntimeDir, `${m}.mjs`);

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
    "node-mock-http/_polyfill/events": "node:events",
    "node-mock-http/_polyfill/buffer": "node:buffer",
  },
  inject: {
    process: resolvePresetRuntime("process"),
    Buffer: ["node:buffer", "Buffer"],
    "global.Buffer": ["node:buffer", "Buffer"],
    "globalThis.Buffer": ["node:buffer", "Buffer"],
  },
};
