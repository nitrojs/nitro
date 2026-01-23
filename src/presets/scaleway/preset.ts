import { defineNitroPreset } from "../_utils/preset.ts";

const scalewayServerless = defineNitroPreset(
  {
    entry: "./scaleway/runtime/scaleway-serverless",
    rollupConfig: {
      output: {
        entryFileNames: "index.mjs",
        format: "esm",
      },
    },
  },
  {
    name: "scaleway-serverless" as const,
  }
);

export default [scalewayServerless] as const;
