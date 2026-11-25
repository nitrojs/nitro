import { defineNitroPreset } from "../_utils/preset.ts";
import { warnUnsupportedFeatures, writeNeonOutput } from "./utils.ts";

const neon = defineNitroPreset(
  {
    entry: "./neon/runtime/neon",
    serveStatic: true,
    commands: {
      preview: "npx srvx --prod ./",
      deploy: "neon functions deploy <slug> --src ./ --no-bundle",
    },
    // Neon Functions inject `PGHOST`, `PGUSER`, `PGPASSWORD` and `PGDATABASE` for the
    // branch Postgres, which `pg` reads at runtime.
    database: {
      default: { connector: "postgresql", options: { ssl: true } },
    },
    hooks: {
      "build:before"(nitro) {
        warnUnsupportedFeatures(nitro);
      },
      async compiled(nitro) {
        await writeNeonOutput(nitro);
      },
    },
  },
  {
    name: "neon" as const,
    aliases: ["neon-functions"],
  }
);

export default [neon] as const;
