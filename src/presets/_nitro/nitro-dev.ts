import { defineNitroPreset } from "nitropack/kit";

const nitroDev = defineNitroPreset(
  {
    entry: "./runtime/nitro-dev",
    output: {
      dir: "{{ buildDir }}/dev",
      serverDir: "{{ buildDir }}/dev",
      publicDir: "{{ buildDir }}/dev",
    },
    externals: { trace: false },
    serveStatic: true,
    // Keep lazy handlers as real, code-split dynamic imports in dev. When this
    // is `true`, Rollup inlines every lazy handler into a single `index.mjs`
    // and evaluates each server module eagerly at that module's top level, so
    // one module throwing at import time aborts the whole bundle's evaluation
    // and leaves unrelated `const`s (e.g. `renderer`) in the temporal dead
    // zone. Every request then fails with a misleading
    // `Cannot access '<x>' before initialization` instead of the real error.
    // See nitrojs/nitro#1670, nuxt/nuxt#20576.
    inlineDynamicImports: false,
    sourceMap: true,
  },
  {
    name: "nitro-dev" as const,
    dev: true,
    url: import.meta.url,
  }
);

export default [nitroDev] as const;
