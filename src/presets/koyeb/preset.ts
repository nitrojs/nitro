import { defineNitroPreset } from "nitro/kit";

const koyeb = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "koyeb" as const,
    url: import.meta.url,
  }
);

export default [koyeb] as const;
