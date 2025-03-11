import { defineNitroPreset } from "../_utils/preset";

const renderCom = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "render-com" as const,
    url: import.meta.url,
  }
);

export default [renderCom] as const;
