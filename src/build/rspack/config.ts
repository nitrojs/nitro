import type { Nitro, NitroBuildPluginOption, RspackConfig } from "nitro/types";
import type { Configuration, ExternalItemFunctionData, RuleSetRule } from "@rspack/core";
import type { Plugin } from "rollup";
import { builtinModules } from "node:module";
import { defu } from "defu";
import { unwasmRspack } from "unwasm/plugin/rspack";
import { baseBuildConfig } from "../config.ts";
import { excludeSourcemapSources } from "../plugins/sourcemap.ts";
import { baseBuildPlugins, flatPlugins, withBuildPlugins } from "../plugins.ts";
import { LOADER_PATH, RollupPluginsHost } from "./_plugin.ts";
import { loaderRule } from "./_filters.ts";
import { moduleFilenameTemplate } from "./_sourcemap.ts";
import { externalsMatcher, rollupOptions } from "./_rollup.ts";
import { ChunkNames } from "./_chunks.ts";

export async function getRspackConfig(
  nitro: Nitro,
  rspack: typeof import("@rspack/core")
): Promise<RspackConfig> {
  const base = await baseBuildConfig(nitro);

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  // Covered by Rspack itself: `devtool` excludes source contents, WASM has a native Rspack plugin
  // and Rspack emits the files referenced with `new URL(..., import.meta.url)` itself
  const plugins = (await baseBuildPlugins(nitro, base)).filter(
    (plugin) => !/^(nitro:sourcemap|unwasm)/.test(plugin.name)
  );
  // Presets (and users) configure output options and plugins with `rollupConfig`
  const rollup = rollupOptions(nitro, rspack);
  const rollupConfigs = [nitro.options.rolldownConfig, nitro.options.rollupConfig];
  const rollupConfigPlugins = await flatPlugins(
    rollupConfigs.flatMap((config) => (config?.plugins as NitroBuildPluginOption[]) || [])
  );

  // Builtins aliased to polyfills are bundled
  const builtins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)].filter(
    (id) => !base.env.alias[id] || base.env.alias[id].startsWith("node:")
  );

  const pluginsHost = new RollupPluginsHost(
    nitro,
    [...rollupConfigPlugins, ...(await withBuildPlugins(nitro, plugins))] as Plugin[],
    { externals: [...base.env.external, ...builtins] }
  );

  const entryFileName = rollup.entryFileName || "index.mjs";
  const chunkNames = new ChunkNames(nitro, {
    toId: (resource) => pluginsHost.virtual.toId(resource),
    reserved: [entryFileName],
  });
  const chunkFilename = rollup.chunkFileName || chunkNames.filename;
  // Rspack loads chunks with dynamic import specifiers, which worker runtimes do not support,
  // so `inlineDynamicImports: false` of presets does not split them
  const asyncChunks = !(nitro.options.inlineDynamicImports || rollup.inlineDynamicImports);

  const swcRule: RuleSetRule = {
    test: /\.(?:[cm]?tsx?|jsx)$/,
    loader: "builtin:swc-loader",
    options: {
      detectSyntax: "auto",
      jsc: {
        transform: {
          react: {
            runtime: tsc?.jsx === "react" ? "classic" : "automatic",
            pragma: tsc?.jsxFactory,
            pragmaFrag: tsc?.jsxFragmentFactory,
            importSource: tsc?.jsxImportSource,
            development: nitro.options.dev,
          },
        },
      },
    },
  };

  const config: Configuration = {
    mode: nitro.options.dev ? "development" : "production",
    context: nitro.options.rootDir,
    target: nitro.options.node ? "node22" : "es2022",
    entry: { index: nitro.options.entry },
    devtool: nitro.options.sourcemap
      ? (rollup.sourcemapExcludeSources ?? excludeSourcemapSources(nitro))
        ? "nosources-source-map"
        : "source-map"
      : false,
    cache: nitro.options.dev,
    stats: "none",
    infrastructureLogging: { level: "warn" },
    performance: false,
    node: nitro.options.node ? { __dirname: "node-module", __filename: "node-module" } : false,
    externalsType: "module-import",
    externals: [
      rollup.isExternal &&
        externalsMatcher(nitro, rollup.isExternal, (issuer) => pluginsHost.virtual.toId(issuer)),
      (data: ExternalItemFunctionData) => pluginsHost.externals(data),
    ].filter((external) => !!external),
    resolve: {
      alias: base.aliases,
      extensions: base.extensions,
      byDependency: {
        esm: { conditionNames: [...nitro.options.exportConditions!, "import"] },
        commonjs: { conditionNames: [...nitro.options.exportConditions!, "require"] },
      },
    },
    module: {
      parser: {
        // `import.meta.*` replacements are applied by Nitro, others are kept as is (runtime values)
        javascript: { importMeta: false, url: !!nitro.options.node, worker: false },
      },
      rules: [
        { test: /\.[cm]?[jt]sx?$/, resolve: { fullySpecified: false } },
        loaderRule({
          test: /\.[cm]?[jt]sx?$/,
          loader: LOADER_PATH,
          options: pluginsHost.loaderOptions,
          virtualDir: pluginsHost.virtual.dir,
          hooks: pluginsHost.host.hooks,
          rspackVersion: rspack.rspackVersion,
        }),
        swcRule,
      ],
    },
    plugins: [
      pluginsHost,
      chunkNames,
      nitro.options.wasm !== false && unwasmRspack(nitro.options.wasm || {}),
      Object.keys(base.env.inject).length > 0 &&
        new rspack.ProvidePlugin(base.env.inject as Record<string, string | string[]>),
      ...rollup.plugins,
    ],
    optimization: {
      minimize: !!nitro.options.minify,
      nodeEnv: false,
      splitChunks: asyncChunks && chunkNames.splitChunks(chunkFilename),
      // Readable ids in development, without module paths in production builds
      chunkIds: nitro.options.dev ? "named" : "deterministic",
    },
    output: {
      path: nitro.options.output.serverDir,
      module: true,
      filename: entryFileName,
      chunkFilename,
      assetModuleFilename: "_assets/[name]-[hash][ext]",
      publicPath: "auto",
      library: { type: "module" },
      chunkFormat: "module",
      chunkLoading: "import",
      asyncChunks,
      devtoolModuleFilenameTemplate: moduleFilenameTemplate({
        rootDir: nitro.options.rootDir,
        virtual: pluginsHost.virtual,
      }),
    },
  };

  return defu(nitro.options.rspackConfig as Configuration, config) as RspackConfig;
}
