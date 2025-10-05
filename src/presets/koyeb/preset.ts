import { defineNitroPreset } from "../_utils/preset";

const koyeb = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "koyeb" as const,
  }
);

export default [koyeb] as const;
