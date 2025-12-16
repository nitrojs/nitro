import { defineNitroPreset } from "../_utils/preset.ts";

const heroku = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "heroku" as const,
  }
);

export default [heroku] as const;
