import { defineNitroPreset } from "nitro/kit";

const cleavr = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "cleavr" as const,
    stdName: "cleavr",
    url: import.meta.url,
  }
);

export default [cleavr] as const;
