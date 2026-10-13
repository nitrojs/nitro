import { defineNitroPreset } from "../_utils/preset.ts";

const flightControl = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "flight-control" as const,
  }
);

export default [flightControl] as const;
