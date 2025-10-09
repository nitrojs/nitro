import { defineNitroPreset } from "../_utils/preset";

const digitalOcean = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "digital-ocean" as const,
  }
);

export default [digitalOcean] as const;
