import { defineNitroPreset } from "../_utils/preset";

const platformSh = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "platform-sh" as const,
    url: import.meta.url,
  }
);

export default [platformSh] as const;
