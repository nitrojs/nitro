import { defineNitroPreset } from "../_utils/preset.ts";
import { installModules } from "../../module.ts";

const platformatic = defineNitroPreset(
  {
    extends: "node-server",
    hooks: {
      "build:before": async (nitro) => {
        if (Object.keys(nitro.options.scheduledTasks).length === 0) {
          return;
        }
        await installModules(nitro, ["@platformatic/nitro/scheduler"]);
      },
    },
  },
  {
    name: "platformatic" as const,
    aliases: ["watt"],
  }
);

export default [platformatic] as const;
