import type { RollupConfig } from "nitro/types";
import { defu } from "defu";
import alias from "@rollup/plugin-alias";
import inject from "@rollup/plugin-inject";
import { baseBuildConfig, type BaseBuildConfig } from "../config.ts";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";
import { baseBuildPlugins } from "../plugins.ts";
import type { Plugin as RollupPlugin } from "rollup";
import type { NitroPluginContext } from "./types.ts";

export const getViteRollupConfig = async (
  ctx: NitroPluginContext
): Promise<{ config: RollupConfig; base: BaseBuildConfig }> => {
  const nitro = ctx.nitro!;
  const base = baseBuildConfig(nitro);

  let config = {
    input: nitro.options.entry,
    external: [...base.env.external],
    plugins: [
      ...(await baseBuildPlugins(nitro, base)),
      alias({ entries: base.aliases }),
      !ctx._isRolldown &&
        (inject as unknown as typeof inject.default)(base.env.inject),
    ].filter(Boolean) as RollupPlugin[],
    // rolldown-specific config
    ...(ctx._isRolldown
      ? {
          transform: {
            inject: base.env.inject as Record<string, string>,
          },
        }
      : {}),
    treeshake: {
      moduleSideEffects(id) {
        return nitro.options.moduleSideEffects.some((p) => id.startsWith(p));
      },
    },
    onwarn(warning, warn) {
      if (!base.ignoreWarningCodes.has(warning.code || "")) {
        warn(warning);
      }
    },
    output: {
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk) => getChunkName(chunk, nitro),
      ...(ctx._isRolldown
        ? {
            advancedChunks: {
              groups: [
                {
                  test: NODE_MODULES_RE,
                  name: (id: string) => libChunkName(id),
                },
              ],
            },
          }
        : {
            manualChunks(id: string) {
              if (NODE_MODULES_RE.test(id)) {
                return libChunkName(id);
              }
            },
          }),
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      dir: nitro.options.output.serverDir,
      generatedCode: {
        // constBindings is not supported in rolldown
        ...(ctx._isRolldown ? {} : { constBindings: true }),
      },
      // sanitizeFileName: sanitizeFilePath,
      // sourcemapExcludeSources is not supported in rolldown
      ...(ctx._isRolldown ? {} : { sourcemapExcludeSources: true }),
      sourcemapIgnoreList: (id) => id.includes("node_modules"),
    },
  } satisfies RollupConfig;

  config = defu(nitro.options.rollupConfig as any, config);

  return { config, base };
};
