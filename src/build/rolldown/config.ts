import type { Nitro } from "nitro/types";
import type { OutputOptions, RolldownOptions, RolldownPlugin } from "rolldown";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins } from "../plugins.ts";
import { builtinModules } from "node:module";
import { defu } from "defu";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";

export const getRolldownConfig = (nitro: Nitro): RolldownOptions => {
  const base = baseBuildConfig(nitro);

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  let config: RolldownOptions = {
    platform: nitro.options.node ? "node" : "neutral",
    cwd: nitro.options.rootDir,
    input: nitro.options.entry,
    external: [
      ...base.env.external,
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
    ],
    plugins: [...(baseBuildPlugins(nitro, base) as RolldownPlugin[])],
    resolve: {
      alias: base.aliases,
      extensions: base.extensions,
      mainFields: ["main"], // "module" is intentionally not supported because of externals
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
    output: {
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk) => getChunkName(chunk, nitro),
      advancedChunks: {
        groups: [{ test: NODE_MODULES_RE, name: (id) => libChunkName(id) }],
      },
      dir: nitro.options.output.serverDir,
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      minify: nitro.options.minify,
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
    delete outputConfig.advancedChunks;
  }

  return config as RolldownOptions;
};
