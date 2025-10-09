import { defineNitroPreset } from "../_utils/preset";

const standard = defineNitroPreset(
  {
    entry: "./standard/runtime/server",
    serveStatic: false,
    exportConditions: ["import", "default"],
    commands: {
      preview: "npx srvx --prod ./",
    },
    alias: {
      srvx: "srvx/generic",
      "srvx/node": "srvx/node",
      "srvx/generic": "srvx/generic",
    },
  },
  {
    name: "standard" as const,
  }
);

export default [standard] as const;
