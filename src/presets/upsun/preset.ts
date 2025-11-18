import { defineNitroPreset } from "../_utils/preset.ts";

const upsun = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "upsun" as const,
  }
);

export default [upsun] as const;
