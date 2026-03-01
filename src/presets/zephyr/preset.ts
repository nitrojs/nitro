import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { unenvCfExternals, unenvCfNodeCompat } from "../cloudflare/unenv/preset.ts";
import { LOGGER_TAG, uploadNitroOutputToZephyr } from "./utils.ts";
import { resolve } from "pathe";

export type { ZephyrOptions as PresetOptions } from "./types.ts";

const zephyr = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./zephyr/runtime/server",
    output: {
      publicDir: "{{ output.dir }}/client/{{ baseURL }}",
    },
    exportConditions: ["node"],
    minify: false,
    rollupConfig: {
      output: {
        format: "esm",
        exports: "named",
        inlineDynamicImports: false,
      },
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    hooks: {
      "build:before": (nitro: Nitro) => {
        nitro.options.unenv.push(unenvCfExternals, unenvCfNodeCompat);
      },
      compiled: async (nitro: Nitro) => {
        try {
          if (
            nitro.options.zephyr?.deployOnBuild === false ||
            process.env.NITRO_INTERNAL_ZEPHYR_SKIP_DEPLOY_ON_BUILD === "1"
          ) {
            nitro.logger.info(`[${LOGGER_TAG}] Zephyr deploy skipped on build.`);
            return;
          }

          await uploadNitroOutputToZephyr({
            rootDir: nitro.options.rootDir,
            outputDir: nitro.options.output.dir,
            baseURL: nitro.options.baseURL,
            publicDir: resolve(nitro.options.output.dir, nitro.options.output.publicDir),
          });
          nitro.logger.success(`[${LOGGER_TAG}] Zephyr deployment succeeded.`);
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new TypeError(`[${LOGGER_TAG}] ${String(error)}`);
        }
      },
    },
  },
  {
    name: "zephyr" as const,
  }
);

export default [zephyr] as const;
