import { defineNitroPreset } from "../_utils/preset.ts";

const baseWorker = defineNitroPreset(
  {
    entry: null as any, // Abstract
    node: false,
    minify: true,
    noExternals: true,
    rollupConfig: {
      output: {
        format: "iife",
        generatedCode: {
          symbols: true,
        },
      },
    },
    inlineDynamicImports: true, // iffe does not support code-splitting
  },
  {
    name: "base-worker" as const,
  }
);

export default [baseWorker] as const;
