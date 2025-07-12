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
    inlineDynamicImports: true, // externals plugin limitation
    sourceMap: true,
  },
  {
    name: "nitro-dev" as const,
    dev: true,
    url: import.meta.url,
  }
);

export default [nitroDev] as const;
