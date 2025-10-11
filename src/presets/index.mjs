import { createJiti } from "../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti/lib/jiti.mjs";

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    nitro: "/home/runner/work/nitro/nitro/src/index.ts",
    "nitro/presets": "/home/runner/work/nitro/nitro/src/presets/index.ts",
    "nitro/runtime": "/home/runner/work/nitro/nitro/src/runtime/index.ts",
    "nitro/types": "/home/runner/work/nitro/nitro/src/types/index.ts",
    "nitro/vite": "/home/runner/work/nitro/nitro/src/vite/index.ts",
    "nitro/config": "/home/runner/work/nitro/nitro/lib/config.mjs",
    "nitro/meta": "/home/runner/work/nitro/nitro/lib/meta.mjs",
    "nitro/runtime/meta": "/home/runner/work/nitro/nitro/lib/runtime-meta.mjs",
  },
  transformOptions: {
    babel: {
      plugins: [],
    },
  },
});

/** @type {import("/home/runner/work/nitro/nitro/src/presets/index.js")} */
const _module = await jiti.import(
  "/home/runner/work/nitro/nitro/src/presets/index.ts"
);

export const resolvePreset = _module.resolvePreset;
