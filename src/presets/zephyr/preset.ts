import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { unenvCfExternals, unenvCfNodeCompat } from "../cloudflare/unenv/preset.ts";
import { resolve } from "pathe";
import { importDep } from "../../utils/dep.ts";

export type { ZephyrOptions as PresetOptions } from "./types.ts";
const LOGGER_TAG = "zephyr-nitro-preset";
type ZephyrAgentModule = Pick<typeof import("zephyr-agent"), "uploadOutputToZephyr">;

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
    commands: {
      deploy: deployToZephyr,
    },
    hooks: {
      "build:before": (nitro: Nitro) => {
        nitro.options.unenv.push(unenvCfExternals, unenvCfNodeCompat);
      },
      compiled: async (nitro: Nitro) => {
        if (!nitro.options.zephyr?.deployOnBuild) {
          nitro.logger.info(
            `[${LOGGER_TAG}] Skipping Zephyr deploy on build (use \`nitro deploy\` or set \`zephyr.deployOnBuild\`).`
          );
          return;
        }
        await deployToZephyr(nitro);
      },
    },
  },
  {
    name: "zephyr" as const,
  }
);

export default [zephyr] as const;

// --- internal ---

const deployed = new WeakSet<Nitro>();

async function deployToZephyr(nitro: Nitro): Promise<void> {
  if (deployed.has(nitro)) {
    nitro.logger.info(`[${LOGGER_TAG}] Zephyr deployment already done during build.`);
    return;
  }
  try {
    const zephyrAgent = await importDep<ZephyrAgentModule>({
      id: "zephyr-agent",
      reason: "deploying to Zephyr",
      dir: nitro.options.rootDir,
    });

    const { deploymentUrl } = await zephyrAgent.uploadOutputToZephyr({
      rootDir: nitro.options.rootDir,
      outputDir: nitro.options.output.dir,
      baseURL: nitro.options.baseURL,
      publicDir: resolve(nitro.options.output.dir, nitro.options.output.publicDir),
    });
    if (deploymentUrl) {
      nitro.logger.success(`[${LOGGER_TAG}] Zephyr deployment succeeded: ${deploymentUrl}`);
    } else {
      nitro.logger.success(`[${LOGGER_TAG}] Zephyr deployment succeeded.`);
    }
    deployed.add(nitro);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new TypeError(`[${LOGGER_TAG}] ${String(error)}`);
  }
}
