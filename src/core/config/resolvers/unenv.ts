import type { NitroOptions } from "nitropack/types";
import type { Preset } from "unenv";

export const common: Preset = {
  meta: {
    name: "nitro-common",
    url: import.meta.url,
  },
  alias: {
    "node-mock-http/_polyfill/events": "node:events",
    "node-mock-http/_polyfill/buffer": "node:buffer",
    "buffer/": "node:buffer",
    "buffer/index": "node:buffer",
    "buffer/index.js": "node:buffer",
    "string_decoder/": "node:string_decoder",
    "process/": "node:process",
  },
};

export const nodeless: Preset = {
  meta: {
    name: "nitro-nodeless",
    url: import.meta.url,
  },
  inject: {
    global: "unenv/polyfill/globalthis",
    process: "node:process",
    Buffer: ["node:buffer", "Buffer"],
    clearImmediate: ["node:timers", "clearImmediate"],
    setImmediate: ["node:timers", "setImmediate"],
    performance: "unenv/polyfill/performance",
    PerformanceObserver: ["node:perf_hooks", "PerformanceObserver"],
    BroadcastChannel: ["node:worker_threads", "BroadcastChannel"],
  },
  polyfill: [
    "unenv/polyfill/globalthis-global",
    "unenv/polyfill/process",
    "unenv/polyfill/buffer",
    "unenv/polyfill/timers",
  ],
};

export async function resolveUnenv(options: NitroOptions) {
  options.unenv ??= [];
  if (!Array.isArray(options.unenv)) {
    options.unenv = [options.unenv];
  }
  options.unenv = options.unenv.filter(Boolean);
  if (!options.node) {
    options.unenv.unshift(nodeless);
  }
  options.unenv.unshift(common);
}
