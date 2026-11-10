import type { Nitro, RolldownConfig } from "nitro/types";
import type { OutputOptions, RolldownOptions, RolldownPlugin } from "rolldown";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins, withBuildPlugins } from "../plugins.ts";
import { assetUrls } from "../plugins/asset-urls.ts";
import { excludeSourcemapSources } from "../plugins/sourcemap.ts";
import { defu } from "defu";
import { getChunkName, libChunksGroup } from "../chunks.ts";
import { builtinExternals, builtins } from "../plugins/builtins.ts";

export const getRolldownConfig = async (nitro: Nitro): Promise<RolldownConfig> => {
  const base = await baseBuildConfig(nitro);

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  let config: RolldownOptions = {
    platform: nitro.options.node ? "node" : "neutral",
    cwd: nitro.options.rootDir,
    input: nitro.options.entry,
    // Nitro resolves `tsconfig` and passes relevant options (e.g. `transform.jsx`) explicitly.
    // Disable Rolldown's own tsconfig discovery to avoid `CONFIGURATION_FIELD_CONFLICT` warnings
    // and keep behavior consistent with the Rollup builder.
    tsconfig: false,
    // Rolldown checks `external` before aliases and plugins: builtins aliased to polyfills are
    // bundled, and the ones aliased to another id (all of them without the node platform) are
    // left to `nitro:builtins`
    external: nitro.options.node
      ? [
          ...base.env.external,
          ...builtins.filter((id) => !base.env.alias[id] || base.env.alias[id] === id),
        ]
      : [],
    plugins: await withBuildPlugins(nitro, [
      builtinExternals(base.env, { node: nitro.options.node }),
      ...((await baseBuildPlugins(nitro, base)) as RolldownPlugin[]),
      // Emitted files are read from the filesystem, which worker runtimes do not have
      nitro.options.node && ((await assetUrls(nitro)) as RolldownPlugin),
    ]),
    resolve: {
      alias: base.aliases,
      extensions: base.extensions,
      conditionNames: nitro.options.exportConditions,
    },
    transform: {
      inject: base.env.inject as Record<string, string>,
      jsx: {
        runtime: tsc?.jsx === "react" ? "classic" : "automatic",
        pragma: tsc?.jsxFactory,
        pragmaFrag: tsc?.jsxFragmentFactory,
        importSource: tsc?.jsxImportSource,
        development: nitro.options.dev,
      },
    },
    onwarn(warning, warn) {
      if (!base.ignoreWarningCodes.has(warning.code || "")) {
        warn(warning);
      }
    },
    optimization: {
      inlineConst: true,
    },
    output: {
      format: "esm",
      entryFileNames: "index.mjs",
      minifyInternalExports: false,
      chunkFileNames: (chunk) => getChunkName(chunk, nitro),
      codeSplitting: {
        groups: [libChunksGroup(nitro)],
      },
      dir: nitro.options.output.serverDir,
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      // https://github.com/rolldown/rolldown/issues/7235
      minify: nitro.options.minify ? true : "dce-only",
      sourcemap: nitro.options.sourcemap,
      // nitro:sourcemap removes `sourcesContent` from production maps, so don't generate it
      sourcemapExcludeSources: excludeSourcemapSources(nitro),
      sourcemapIgnoreList(relativePath) {
        return relativePath.includes("node_modules");
      },
    },
  } satisfies RolldownOptions;

  config = defu(
    nitro.options.rolldownConfig as RolldownOptions,
    nitro.options.rollupConfig as RolldownOptions,
    config
  );

  const outputConfig = config.output as OutputOptions;
  if (outputConfig.inlineDynamicImports || outputConfig.format === "iife") {
    outputConfig.codeSplitting = false;
  }
  // `inlineDynamicImports` is deprecated in favor of `codeSplitting: false`
  delete outputConfig.inlineDynamicImports;

  return config as RolldownConfig;
};
