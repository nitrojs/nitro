import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import {
  DEFAULT_BASE_PRESET,
  LOGGER_TAG,
  ZEPHYR_PLATFORM,
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
        nitro.logger.info(
          `[${LOGGER_TAG}] PLATFORM=${ZEPHYR_PLATFORM}; using preset \`${DEFAULT_BASE_PRESET}\`.`
        );
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
        const deployOutputDir = nitro.options.output.dir;
        nitro.logger.info(
          `[${LOGGER_TAG}] Uploading Nitro output to Zephyr from ${deployOutputDir}.`
        );

        try {
          const { deploymentUrl, entrypoint } = await uploadNitroOutputToZephyr(
            nitro,
            deployOutputDir
          );

          if (entrypoint) {
            nitro.logger.info(`[${LOGGER_TAG}] Zephyr SSR entrypoint: ${entrypoint}.`);
          }

          if (deploymentUrl) {
            nitro.logger.success(`[${LOGGER_TAG}] Zephyr deployment URL: ${deploymentUrl}`);
            return;
          }

          nitro.logger.success(
            `[${LOGGER_TAG}] Zephyr deploy completed but no deployment URL was returned.`
          );
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
