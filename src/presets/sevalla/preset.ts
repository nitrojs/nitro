import { defineNitroPreset } from "../_utils/preset";

const sevalla = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "sevalla" as const,
    url: import.meta.url,
  }
);

export default [sevalla] as const;
