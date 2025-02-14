import type { Preset } from "unenv";
import type { Plugin } from "rollup";

import { fileURLToPath } from "mlly";
import { join } from "pathe";

// Built-in APIs provided by workerd with nodejs compatibility
// https://github.com/cloudflare/workers-sdk/blob/main/packages/unenv-preset/src/preset.ts
export const nodeCompatModules = [
  "_stream_duplex",
  "_stream_passthrough",
  "_stream_readable",
  "_stream_transform",
  "_stream_writable",
  "assert",
  "assert/strict",
  "buffer",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "events",
  "net",
  "path",
  "path/posix",
  "path/win32",
  "querystring",
  "stream",
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "timers",
  "timers/promises",
  "url",
  "util/types",
  "zlib",
];

// Modules implemented via a mix of workerd APIs and polyfills
export const hybridNodeCompatModules = ["async_hooks", "crypto", "util"];

const presetRuntimeDir = fileURLToPath(new URL("runtime/", import.meta.url));
const resolvePresetRuntime = (m: string) => join(presetRuntimeDir, `${m}.mjs`);

export const unenvCfPreset: Preset = {
  external: nodeCompatModules.map((m) => `node:${m}`),
  alias: {
    // (native)
    ...Object.fromEntries(
      nodeCompatModules.flatMap((m) => [
        [m, `node:${m}`],
        [`node:${m}`, `node:${m}`],
      ])
    ),
    // (hybrid)
    ...Object.fromEntries(
      hybridNodeCompatModules.flatMap((m) => {
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
    // process: "TODO",
    // console: "TODO",
    Buffer: ["node:buffer", "Buffer"],
    "global.Buffer": ["node:buffer", "Buffer"],
    "globalThis.Buffer": ["node:buffer", "Buffer"],
  },
};

export const hybridNodePlugin: Plugin = {
  name: "nitro:cloudflare:hybrid-node-compat",
  resolveId(id) {
    if (id.startsWith("cloudflare:")) {
      return { id, external: true };
    }
    if (id.startsWith("#workerd/node:")) {
      return { id: id.slice("#workerd/".length), external: true };
    }
  },
};
