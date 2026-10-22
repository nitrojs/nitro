import { defineNitroPreset } from "../_utils/preset.ts";

const nitroServe = defineNitroPreset(
  {
    entry: "./_nitro/runtime/nitro-serve",
    serveStatic: false,
  },
  {
    name: "nitro-serve" as const,
  }
);

export default [nitroServe] as const;
