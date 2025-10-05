import { defineNitroPreset } from "../_utils/preset";

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
