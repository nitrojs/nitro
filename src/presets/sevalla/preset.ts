import { defineNitroPreset } from "../_utils/preset.ts";

const sevalla = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "sevalla" as const,
  }
);

export default [sevalla] as const;
