import { defineNitroPreset } from "../_utils/preset.ts";

const renderCom = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "render-com" as const,
  }
);

export default [renderCom] as const;
