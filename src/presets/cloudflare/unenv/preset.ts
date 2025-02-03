// https://github.com/cloudflare/workers-sdk/blob/main/packages/unenv-preset/src/preset.ts

import type { Preset } from "unenv";
import { fileURLToPath } from "mlly";
import { join } from "pathe";

export const cloudflareExternals = [
  "cloudflare:email",
  "cloudflare:sockets",
  "cloudflare:workers",
  "cloudflare:workflows",
] as const;

// Built-in APIs provided by workerd with nodejs compatibility.
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

// Modules implemented via a mix of workerd APIs and polyfills.
export const hybridNodeCompatModules = [
  "async_hooks",
  "crypto",
  "perf_hooks",
  "util",
  "sys",
  "node:sys",
];

const presetRuntimeDir = fileURLToPath(new URL("runtime/", import.meta.url));
const resolvePresetRuntime = (m: string) => join(presetRuntimeDir, `${m}.mjs`);

export const unenvCfPreset: Preset = {
  external: nodeCompatModules.map((m) => `node:${m}`),
  alias: {
    // <id> => node:<id>
    ...Object.fromEntries(nodeCompatModules.map((m) => [m, `node:${m}`])),
    // node:<id> => runtime/<id>.mjs
    ...Object.fromEntries(
      hybridNodeCompatModules.map((m) => [
        `node:${m}`,
        resolvePresetRuntime(m === "sys" ? "util" : m),
      ])
    ),
  },
};
