import { defineNitroPreset } from "../_utils/preset";

const cleavr = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "cleavr" as const,
    stdName: "cleavr",
  }
);

export default [cleavr] as const;
