import type { Nitro } from "nitro/types";
import type { OutputOptions, RolldownOptions, RolldownPlugin } from "rolldown";
import { viteAliasPlugin } from "rolldown/experimental";
import { esmExternalRequirePlugin } from "rolldown/plugins";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins } from "../plugins.ts";
import { builtinModules } from "node:module";
import { defu } from "defu";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";

export const getRolldownConfig = async (nitro: Nitro): Promise<RolldownOptions> => {
  const base = baseBuildConfig(nitro);
  const isNodeless = nitro.options.node === false;
  const builtinExternal = isNodeless
    ? []
    : [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];
  const nodeBuiltinAliases = getNodeBuiltinAliases(base.aliases);
  const external = isNodeless
    ? base.env.external.filter((id) => !id.startsWith("node:"))
    : [...base.env.external, ...builtinExternal];

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  let config: RolldownOptions = {
    platform: nitro.options.node ? "node" : "neutral",
    cwd: nitro.options.rootDir,
    input: nitro.options.entry,
    external,
    plugins: [
      ...(isNodeless
        ? [
            ...(nodeBuiltinAliases.length > 0
              ? [viteAliasPlugin({ entries: nodeBuiltinAliases })]
              : []),
            nodeBuiltinImportExternalPlugin(),
            esmExternalRequirePlugin({ external: [/^node:/] }),
          ]
        : []),
      ...((await baseBuildPlugins(nitro, base)) as RolldownPlugin[]),
    ],
    resolve: {
      alias: isNodeless ? omitAliases(base.aliases, nodeBuiltinAliases) : base.aliases,
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

function getNodeBuiltinAliases(aliases: Record<string, string>) {
  return Object.entries(aliases)
    .filter(([find, replacement]) => !find.startsWith("node:") && replacement.startsWith("node:"))
    .map(([find, replacement]) => ({
      key: find,
      find: new RegExp(`^${escapeRegExp(find)}$`),
      replacement,
    }));
}

function omitAliases(
  aliases: Record<string, string>,
  omittedAliases: { key: string; find: RegExp; replacement: string }[]
) {
  const omitted = new Set(omittedAliases.map((entry) => entry.key));
  return Object.fromEntries(Object.entries(aliases).filter(([key]) => !omitted.has(key)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nodeBuiltinImportExternalPlugin(): RolldownPlugin {
  return {
    name: "nitro:rolldown-node-builtin-import-external",
    resolveId(source, _importer, extraOptions) {
      if (!source.startsWith("node:") || extraOptions.kind === "require-call") {
        return null;
      }
      return { id: source, external: true };
    },
  };
}
