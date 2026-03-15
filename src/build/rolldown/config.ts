import type { Nitro } from "nitro/types";
import type { OutputOptions, RolldownOptions, RolldownPlugin } from "rolldown";
import { esmExternalRequirePlugin } from "rolldown/plugins";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins } from "../plugins.ts";
import { builtinModules } from "node:module";
import { defu } from "defu";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";
import { requireConditionResolver } from "./require-condition.ts";

export const getRolldownConfig = async (nitro: Nitro): Promise<RolldownOptions> => {
  const base = baseBuildConfig(nitro);
  const builtinExternals = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];
  const plugins: RolldownPlugin[] = [
    requireConditionResolver(nitro),
    ...(!nitro.options.node
      ? [
          esmExternalRequirePlugin({
            external: builtinExternals,
            skipDuplicateCheck: true,
          }) as RolldownPlugin,
        ]
      : []),
    ...((await baseBuildPlugins(nitro, base)) as RolldownPlugin[]),
  ];

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  let config: RolldownOptions = {
    platform: nitro.options.node ? "node" : "neutral",
    cwd: nitro.options.rootDir,
    input: nitro.options.entry,
    external: nitro.options.node
      ? [...base.env.external, ...builtinExternals]
      : [...base.env.external],
    plugins,
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
        console.log(warning.code);
        warn(warning);
      }
    },
    treeshake: {
      moduleSideEffects(id) {
        return nitro.options.moduleSideEffects.some((p) => id.startsWith(p));
      },
    },
    optimization: {
      inlineConst: true,
    },
    output: {
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk) => getChunkName(chunk, nitro),
      codeSplitting: {
        groups: [{ test: NODE_MODULES_RE, name: (id) => libChunkName(id) }],
      },
      dir: nitro.options.output.serverDir,
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      // https://github.com/rolldown/rolldown/issues/7235
      minify: nitro.options.minify ? true : "dce-only",
      sourcemap: nitro.options.sourcemap,
      sourcemapIgnoreList(relativePath) {
        return relativePath.includes("node_modules");
      },
    },
  } satisfies RolldownOptions;

  config = defu(
    nitro.options.rolldownConfig,
    nitro.options.rollupConfig as RolldownOptions,
    config
  );

  const outputConfig = config.output as OutputOptions;
  if (outputConfig.inlineDynamicImports || outputConfig.format === "iife") {
    delete outputConfig.inlineDynamicImports;
    outputConfig.codeSplitting = false;
  }

  return config as RolldownOptions;
};
