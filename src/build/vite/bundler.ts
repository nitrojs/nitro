import { defu } from "defu";
import alias from "@rollup/plugin-alias";
import inject from "@rollup/plugin-inject";
import { baseBuildConfig, type BaseBuildConfig } from "../config.ts";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";
import { baseBuildPlugins } from "../plugins.ts";

import type { RolldownConfig, RollupConfig } from "nitro/types";
import type { Plugin as RollupPlugin } from "rollup";
import type { NitroPluginContext } from "./types.ts";

export const getBundlerConfig = (
  ctx: NitroPluginContext
): {
  rollupConfig: RollupConfig;
  rolldownConfig: RolldownConfig;
  base: BaseBuildConfig;
} => {
  const nitro = ctx.nitro!;
  const base = baseBuildConfig(nitro);

  const commonConfig = {
    input: nitro.options.entry,
    external: [...base.env.external],
    plugins: [
      ...baseBuildPlugins(nitro, base),
      alias({ entries: base.aliases }),
    ].filter(Boolean) as RollupPlugin[],
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
      dir: nitro.options.output.serverDir,
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk: { name: string; moduleIds: string[] }) =>
        getChunkName(chunk, nitro),
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      sourcemapIgnoreList: (id) => id.includes("node_modules"),
    },
  } satisfies RollupConfig & RolldownConfig;

  if (ctx._isRolldown) {
    // Rolldown
    const rolldownConfig: RolldownConfig = {
      transform: {
        inject: base.env.inject as Record<string, string>,
      },
      output: {
        advancedChunks: {
          groups: [
            {
              test: NODE_MODULES_RE,
              name: (id: string) => libChunkName(id),
            },
          ],
        },
      },
    } satisfies RolldownConfig;
  } else {
    // Rollup
    const rollupConfig: RollupConfig = defu(
      {
        plugins: [
          (inject as unknown as typeof inject.default)(base.env.inject),
        ],
        output: {
          sourcemapExcludeSources: true,
          generatedCode: {
            constBindings: true,
          },
          manualChunks(id: string) {
            if (NODE_MODULES_RE.test(id)) {
              return libChunkName(id);
            }
          },
        },
      } satisfies RollupConfig,
      commonConfig
    );
  }

  return { rollupConfig, rolldownConfig, base };
};
