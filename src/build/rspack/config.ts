import type { Nitro, NitroBuildPluginOption, RspackConfig } from "nitro/types";
import type {
  Configuration,
  ExternalItem,
  ExternalItemFunctionData,
  RuleSetRule,
} from "@rspack/core";
import type { Plugin } from "rollup";
import { defu } from "defu";
import { unwasmRspack } from "unwasm/plugin/rspack";
import { baseBuildConfig } from "../config.ts";
import { builtins } from "../plugins/builtins.ts";
import { excludeSourcemapSources } from "../plugins/sourcemap.ts";
import { baseBuildPlugins, flatPlugins, withBuildPlugins } from "../plugins.ts";
import { LOADER_PATH, RollupPluginsHost } from "./_plugin.ts";
import { loaderRule } from "./_filters.ts";
import { moduleFilenameTemplate } from "./_sourcemap.ts";
import { rollupOptions } from "./_rollup.ts";
import { ChunkNames } from "./_chunks.ts";

export async function getRspackConfig(
  nitro: Nitro,
  rspack: typeof import("@rspack/core")
): Promise<RspackConfig> {
  const base = await baseBuildConfig(nitro);

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  // Covered by Rspack itself: `devtool` excludes source contents, WASM has a native Rspack plugin,
  // Rspack emits the files referenced with `new URL(..., import.meta.url)` itself and the server
  // main banner is added natively (no `renderChunk` round trip of the entry chunk)
  const plugins = (await baseBuildPlugins(nitro, base)).filter(
    (plugin) => !/^(nitro:sourcemap|nitro:server-main|unwasm)/.test(plugin.name)
  );
  // Presets (and users) configure output options and plugins with `rollupConfig`
  const rollup = rollupOptions(nitro, rspack);
  const rollupConfigs = [nitro.options.rolldownConfig, nitro.options.rollupConfig];
  const rollupConfigPlugins = await flatPlugins(
    rollupConfigs.flatMap((config) => (config?.plugins as NitroBuildPluginOption[]) || [])
  );

  // Builtins aliased to polyfills are bundled, and ids aliased to another `node:` id (e.g. `events`
  // or `buffer/`) are externalized with that id
  const externals = new Map(base.env.external.map((id) => [id, id]));
  for (const id of builtins) {
    if (!base.env.alias[id] || base.env.alias[id] === id) {
      externals.set(id, id);
    }
  }
  for (const [id, to] of Object.entries(base.env.alias)) {
    if (to !== id && to.startsWith("node:")) {
      externals.set(id, to);
    }
  }

  const pluginsHost = new RollupPluginsHost(
    nitro,
    [...rollupConfigPlugins, ...(await withBuildPlugins(nitro, plugins))] as Plugin[],
    {
      externals,
      runtimeBuiltins: base.env.external.filter((id) => id.startsWith("node:")),
      isExternal: rollup.isExternal,
    }
  );

  const entryFileName = rollup.entryFileName || "index.mjs";
  const chunkNames = new ChunkNames(nitro, {
    toId: pluginsHost.toId,
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
    infrastructureLogging: { level: "warn" },
    node: nitro.options.node ? undefined : false,
    externalsType: "module-import",
    externals: [(data: ExternalItemFunctionData) => pluginsHost.externals(data)],
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
          host: pluginsHost,
          virtualDir: pluginsHost.virtual.dir,
          hooks: pluginsHost.host.hooks,
        }),
        swcRule,
      ],
    },
    plugins: [
      pluginsHost,
      chunkNames,
      new rspack.BannerPlugin({
        banner: "globalThis.__nitro_main__ = import.meta.url;",
        raw: true,
        entryOnly: true,
        test: /\.m?js$/,
      }),
      nitro.options.wasm !== false && unwasmRspack(nitro.options.wasm || {}),
      Object.keys(base.env.inject).length > 0 &&
        new rspack.ProvidePlugin(base.env.inject as Record<string, string | string[]>),
      ...rollup.plugins,
    ],
    optimization: {
      minimize: !!nitro.options.minify,
      nodeEnv: false,
      splitChunks: asyncChunks && chunkNames.splitChunks(chunkFilename),
    },
    output: {
      path: nitro.options.output.serverDir,
      module: true,
      filename: entryFileName,
      chunkFilename,
      assetModuleFilename: "_assets/[name]-[hash][ext]",
      publicPath: "auto",
      library: { type: "module" },
      asyncChunks,
      devtoolModuleFilenameTemplate: moduleFilenameTemplate({
        rootDir: nitro.options.rootDir,
        virtual: pluginsHost.virtual,
      }),
    },
  };

  const userConfig = nitro.options.rspackConfig as Configuration | undefined;
  const merged = defu(userConfig, config);
  // `defu` only concatenates arrays, Nitro's externals function has to be kept
  if (userConfig?.externals !== undefined && !Array.isArray(userConfig.externals)) {
    merged.externals = [userConfig.externals, ...(config.externals as ExternalItem[])];
  }
  return merged as RspackConfig;
}
