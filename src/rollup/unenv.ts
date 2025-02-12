import type { Preset } from "unenv";

export const common: Preset = {
  alias: {
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
  alias: {},
  inject: {
    performance: "unenv/polyfill/performance",
    "global.Buffer": ["unenv/node/buffer", "Buffer"],
    "globalThis.Buffer": ["unenv/node/buffer", "Buffer"],
  },
  polyfill: ["unenv/polyfill/globalthis-global", "unenv/polyfill/process"],
};
