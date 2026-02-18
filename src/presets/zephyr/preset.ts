import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import {
  DEFAULT_BASE_PRESET,
  LOGGER_TAG,
  createZephyrMetadataPlugin,
  resolveBundlerOutputDir,
  toError,
  uploadNitroOutputToZephyr,
} from "./utils.ts";

const zephyr = defineNitroPreset(
  {
    extends: DEFAULT_BASE_PRESET,
    hooks: {
      "build:before": (nitro: Nitro) => {
        // Zephyr deploy flow replaces Nitro preset command hints (wrangler).
        delete nitro.options.commands.preview;
        delete nitro.options.commands.deploy;
      },
      "rollup:before": (nitro: Nitro, config) => {
        const outputDir = resolveBundlerOutputDir(nitro, config);
        const plugin = createZephyrMetadataPlugin(nitro, outputDir);

        if (!Array.isArray(config.plugins)) {
          config.plugins = [plugin];
          return;
        }

        config.plugins.push(plugin);
      },
      compiled: async (nitro: Nitro) => {
        try {
          await uploadNitroOutputToZephyr(nitro, nitro.options.output.dir);
          nitro.logger.success(`[${LOGGER_TAG}] Zephyr deployment succeeded.`);
        } catch (error) {
          throw toError(error);
        }
      },
    },
  },
  {
    name: "zephyr" as const,
  }
);

export default [zephyr] as const;
