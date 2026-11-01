import { defu } from "defu";
import { baseBuildConfig, type BaseBuildConfig } from "../config.ts";
import { getChunkName, libChunkName, libChunksGroup, NODE_MODULES_RE } from "../chunks.ts";
import { baseBuildPlugins, withBuildPlugins } from "../plugins.ts";
import { assetUrls } from "../plugins/asset-urls.ts";
import { builtinExternals } from "../plugins/builtins.ts";
import { excludeSourcemapSources } from "../plugins/sourcemap.ts";

import type { RolldownConfig, RollupConfig } from "nitro/types";
import type { Plugin as RollupPlugin } from "rollup";
import type { NitroPluginContext } from "./types.ts";

export const getBundlerConfig = async (
  ctx: NitroPluginContext
): Promise<{
  base: BaseBuildConfig;
  rollupConfig?: RollupConfig;
  rolldownConfig?: RolldownConfig;
}> => {
  const nitro = ctx.nitro!;
  const base = await baseBuildConfig(nitro);
  const nitroPlugins = (await baseBuildPlugins(nitro, base)).filter(Boolean) as RollupPlugin[];
  // Emitted files are read from the filesystem, which worker runtimes do not have.
  // Not in dev: the module runner evaluates modules from their original location.
  // `build.emitAssets` is enabled for them (`env.ts`): other assets are still dropped
  if (nitro.options.node && !nitro.options.dev) {
    nitroPlugins.push(await assetUrls(nitro, { dropOtherAssets: true }));
  }

  const commonConfig = {
    input: nitro.options.entry,
    external: [...base.env.external],
    onwarn(warning, warn) {
      if (!base.ignoreWarningCodes.has(warning.code || "")) {
        warn(warning);
      }
    },
    output: {
      dir: nitro.options.output.serverDir,
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk: { name: string; moduleIds: string[] }) => getChunkName(chunk, nitro),
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      sourcemapIgnoreList: (id) => id.includes("node_modules"),
    },
  } satisfies RollupConfig & RolldownConfig;

  if (ctx._isRolldown) {
    // Rolldown
    // Bundled `require()` of builtins only needs rewriting in production builds for non-node runtimes
    const builtinsPlugin =
      !nitro.options.node && !nitro.options.dev && builtinExternals(base.env, { node: false });
    const rolldownConfig: RolldownConfig = defu(
      {
        transform: {
          inject: base.env.inject as Record<string, string>,
        },
        output: {
          minifyInternalExports: false,
          // nitro:sourcemap removes `sourcesContent` from production maps, so don't generate it.
          // `undefined` otherwise, so a user's `rolldownConfig.output.sourcemapExcludeSources`
          // still applies (defu gives this object priority)
          sourcemapExcludeSources: excludeSourcemapSources(nitro) || undefined,
          codeSplitting: {
            groups: [libChunksGroup(nitro)],
          },
        },
      } satisfies RolldownConfig,
      nitro.options.rolldownConfig,
      nitro.options.rollupConfig as RolldownConfig, // Added for backward compatibility
      {
        ...commonConfig,
        // Left to `nitro:builtins` (Rolldown checks `external` before plugins)
        external: builtinsPlugin ? [] : commonConfig.external,
        plugins: await withBuildPlugins(nitro, [builtinsPlugin, ...nitroPlugins]),
      } satisfies RolldownConfig
    );

    const outputConfig = rolldownConfig.output!;
    if (outputConfig.inlineDynamicImports || outputConfig.format === ("iife" as string)) {
      outputConfig.codeSplitting = false;
    }
    // `inlineDynamicImports` is deprecated in favor of `codeSplitting: false`
    delete outputConfig.inlineDynamicImports;

    return { base, rolldownConfig };
  } else {
    // Rollup
    const inject = (
      (await import("@rollup/plugin-inject")) as unknown as typeof import("@rollup/plugin-inject")
    ).default;
    const alias = (
      (await import("@rollup/plugin-alias")) as unknown as typeof import("@rollup/plugin-alias")
    ).default;

    const rollupConfig: RollupConfig = defu(
      {
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
      nitro.options.rolldownConfig as RollupConfig, // Added for backward compatibility
      nitro.options.rollupConfig,
      {
        ...commonConfig,
        plugins: await withBuildPlugins(nitro, [
          inject(base.env.inject),
          alias({ entries: base.aliases }),
          ...nitroPlugins,
        ]),
      }
    );

    const outputConfig = rollupConfig.output!;
    // Same default as the rollup builder.
    outputConfig.importAttributesKey ??= "with";
    if (outputConfig.inlineDynamicImports || outputConfig.format === ("iife" as string)) {
      delete outputConfig.manualChunks;
    }

    return { base, rollupConfig };
  }
};
