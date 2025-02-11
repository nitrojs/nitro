import type { Preset } from "unenv";

export const common: Preset = {
  alias: {
    "node-fetch": "unenv/npm/node-fetch",
    "cross-fetch": "unenv/npm/cross-fetch",
    "cross-fetch/polyfill": "unenv/mock/empty",
    "isomorphic-fetch": "unenv/mock/empty",
    debug: "unenv/npm/debug",
    // buffer (npm)
    buffer: "node:buffer",
    "buffer/": "node:buffer",
    "buffer/index": "node:buffer",
    "buffer/index.js": "node:buffer",
  },
};

export const node: Preset = {
  alias: {
    "node-mock-http/_polyfill/events": "node:events",
    "node-mock-http/_polyfill/buffer": "node:buffer",
  },
};

export const nodeless: Preset = {
  alias: {
    fsevents: "unenv/npm/fsevents",
    inherits: "unenv/npm/inherits",
    "whatwg-url": "unenv/npm/whatwg-url",
  },
  inject: {
    performance: "unenv/polyfill/performance",
    global: "unenv/polyfill/globalthis",
    process: "unenv/node/process",
    Buffer: ["unenv/node/buffer", "Buffer"],
  },
  polyfill: [
    // Backward compatibility (remove in v2)
    // https://github.com/unjs/unenv/pull/427
    "unenv/polyfill/globalthis-global",
    "unenv/polyfill/process",
    "unenv/polyfill/performance",
  ],
};
