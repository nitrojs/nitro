import { defineNitroPreset } from "../_utils/preset";

const nitroDev = defineNitroPreset(
  {
    extends: "node",
    entry: "./runtime/nitro-dev",
    output: {
      serverDir: "{{ buildDir }}/dev",
    },
    externals: { trace: false },
    inlineDynamicImports: true, // externals plugin limitation
    sourceMap: true,
  },
  {
    name: "nitro-dev" as const,
    url: import.meta.url,
  }
);

export default [nitroDev] as const;
