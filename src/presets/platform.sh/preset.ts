import { defineNitroPreset } from "../_utils/preset";

const platformSh = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "platform-sh" as const,
  }
);

export default [platformSh] as const;
