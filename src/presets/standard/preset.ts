import { defineNitroPreset } from "../_utils/preset";

const standard = defineNitroPreset(
  {
    entry: "./standard/runtime/server",
    serveStatic: false,
    commands: {
      preview: "npx srvx --prod ./",
    },
  },
  {
    name: "standard" as const,
  }
);

export default [standard] as const;
