import { defineNitroPreset } from "../_utils/preset";

const standard = defineNitroPreset(
  {
    entry: "./runtime/server",
    serveStatic: false,
    commands: {
      preview: "npx srvx --prod ./",
    },
  },
  {
    name: "standard" as const,
    url: import.meta.url,
  }
);

export default [standard] as const;
