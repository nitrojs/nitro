import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { unenvCfExternals, unenvCfNodeCompat } from "../cloudflare/unenv/preset.ts";
import { LOGGER_TAG, uploadNitroOutputToZephyr } from "./utils.ts";
import { resolve } from "pathe";

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
          await uploadNitroOutputToZephyr({
            rootDir: nitro.options.rootDir,
            baseURL: nitro.options.baseURL,
            outputDir: nitro.options.output.dir,
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
