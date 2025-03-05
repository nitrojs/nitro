import { defineNitroPreset } from "nitro/kit";

const platformSh = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "platform-sh" as const,
    url: import.meta.url,
  }
);

export default [platformSh] as const;
