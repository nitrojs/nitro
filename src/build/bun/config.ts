import type { BunConfig, Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { defu } from "defu";
import alias from "@rollup/plugin-alias";
import inject from "@rollup/plugin-inject";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins, withBuildPlugins } from "../plugins.ts";
import { assetUrls } from "../plugins/asset-urls.ts";
import { builtinExternals } from "../plugins/builtins.ts";
import { bunPlugin } from "./_bun-plugin.ts";
import { PluginContainer } from "./_plugins.ts";
import { fromRollupConfig } from "./_rollup-config.ts";

export async function getBunConfig(
  nitro: Nitro
): Promise<{ config: BunConfig; container: PluginContainer }> {
  const base = await baseBuildConfig(nitro);

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  const rollupConfig = await fromRollupConfig(nitro);

  const config: BunConfig = defu(nitro.options.bunConfig, rollupConfig.config, {
    root: nitro.options.rootDir,
    target: nitro.options.preset === "bun" ? "bun" : nitro.options.node ? "node" : "browser",
    external: nitro.options.node ? [...base.env.external] : [],
    conditions: nitro.options.exportConditions,
    naming: {
      entry: "index.mjs",
      chunk: "_chunks/[name]-[hash].mjs",
      asset: "_assets/[name]-[hash].[ext]",
    },
    minify: !!nitro.options.minify,
    sourcemap: nitro.options.sourcemap ? "linked" : "none",
    jsx: {
      runtime: tsc?.jsx === "react" ? "classic" : "automatic",
      factory: tsc?.jsxFactory,
      fragment: tsc?.jsxFragmentFactory,
      importSource: tsc?.jsxImportSource,
      development: nitro.options.dev,
    },
    // `process.env` is read at runtime (Bun inlines `NODE_ENV` even with `env: "disable"`)
    env: "disable",
    define: { "process.env.NODE_ENV": "process.env.NODE_ENV" },
    metafile: true,
  } satisfies BunConfig) as BunConfig;
  // Replaced, not concatenated (`defu` merges arrays)
  config.entrypoints = nitro.options.bunConfig?.entrypoints ?? [nitro.options.entry];

  const plugins = (await withBuildPlugins(nitro, [
    ...rollupConfig.plugins,
    // Bun has no `neutral` target: builtins of runtimes without `node` are handled by Nitro
    builtinExternals(base.env, { node: nitro.options.node }),
    ...(await baseBuildPlugins(nitro, base)),
    alias({ entries: base.aliases }),
    injectPlugin(base.env.inject),
    // Emitted files are read from the filesystem, which worker runtimes do not have
    nitro.options.node && (await assetUrls(nitro)),
  ])) as (Plugin | false | undefined)[];

  const container = new PluginContainer(plugins.filter(Boolean) as Plugin[], {
    rootDir: nitro.options.rootDir,
    depPaths: nitro.options.deps?.paths,
    conditions: nitro.options.exportConditions!,
    extensions: base.extensions,
    isExternal: externalMatcher(config),
    watchMode: nitro.options.dev,
    onWarn: (message) => nitro.logger.warn(message),
  });
  config.plugins = [...(config.plugins || []), bunPlugin(container)];

  return { config, container };
}

/** `@rollup/plugin-inject`, only for modules mentioning a global (without source maps, unused). */
function injectPlugin(modules: Record<string, string | string[]>): Plugin | undefined {
  const keys = Object.keys(modules);
  if (keys.length === 0) {
    return;
  }
  const plugin = (inject as unknown as typeof inject.default)({
    modules: modules as Record<string, string | [string, string]>,
    sourceMap: false,
  });
  const escape = (key: string) => key.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
  const code = new RegExp(`(?<![\\w$])(?:${keys.map((key) => escape(key)).join("|")})(?![\\w$])`);
  return { ...plugin, transform: { filter: { code }, handler: plugin.transform as any } };
}

/**
 * Same as Bun: `external` patterns match ids, their subpaths and `*` wildcards (read on the first
 * call, after the `build:config` hook).
 */
function externalMatcher(config: BunConfig): (id: string) => boolean {
  let patterns: RegExp[] | undefined;
  return (id) => {
    patterns ??= (config.external || []).map(
      (pattern) =>
        new RegExp(
          `^${pattern.replace(/[$()+.?[\\\]^{|}]/g, "\\$&").replaceAll("*", ".*")}(?:/.*)?$`
        )
    );
    return (
      (config.packages === "external" && !/^[./#~]|^[a-z]+:/i.test(id)) ||
      patterns.some((pattern) => pattern.test(id))
    );
  };
}
