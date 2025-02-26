import type { Preset } from "unenv";
import type { Plugin } from "rollup";

import { fileURLToPath } from "mlly";
import { join } from "pathe";

import { builtnNodeModules, hybridNodeModules } from "./node-compat";

const presetRuntimeDir = fileURLToPath(new URL("runtime/", import.meta.url));
const resolvePresetRuntime = (m: string) => join(presetRuntimeDir, `${m}.mjs`);

export const unenvCfPreset: Preset = {
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
    sys: resolvePresetRuntime("util"),
    "node:sys": resolvePresetRuntime("util"),
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

export const hybridNodePlugin: Plugin = {
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
    if (id.startsWith(presetRuntimeDir)) {
      return { id, moduleSideEffects: false };
    }
  },
};
