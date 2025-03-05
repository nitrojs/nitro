import { defineNitroPreset } from "nitro/kit";

const heroku = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "heroku" as const,
    url: import.meta.url,
  }
);

export default [heroku] as const;
