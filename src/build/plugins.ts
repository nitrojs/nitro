import type { Nitro, NitroBuildPlugin, NitroBuildPluginOption } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";
import type { ExternalsTraceOptions } from "nf3";

import { virtualTemplates } from "./virtual/_all.ts";
import { unwasm } from "unwasm/plugin";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { virtual, virtualDeps } from "./plugins/virtual.ts";
import { sourcemap } from "./plugins/sourcemap.ts";
import { raw } from "./plugins/raw.ts";
import { replace } from "./plugins/replace.ts";
import { importAttributes } from "./plugins/import-attributes.ts";
import { externals } from "./plugins/externals.ts";
import { unenv } from "./plugins/unenv.ts";
import { runtimeDeps } from "./plugins/runtime-deps.ts";
import { tsconfigPaths } from "./plugins/tsconfig-paths.ts";

export async function baseBuildPlugins(nitro: Nitro, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Virtual
  const virtualPlugin = virtual(virtualTemplates(nitro, [...base.env.polyfills]));
  nitro.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin, virtualDeps());

  // TypeScript `paths`
  const tsconfigPathsPlugin = tsconfigPaths(nitro, base.aliases);
  if (tsconfigPathsPlugin) {
    plugins.push(tsconfigPathsPlugin);
  }

  // Node.js compatibility polyfills (resolved on demand)
  plugins.push(unenv(nitro, base.env));

  // Optional runtime dependencies (`unstorage`, `db0`) imported by Nitro (resolved on demand)
  plugins.push(runtimeDeps(nitro));

  // WASM loader
  if (nitro.options.wasm !== false) {
    plugins.push(unwasm(nitro.options.wasm || {}));
  }

  // Inject globalThis.__server_main__
  plugins.push(serverMain(nitro));

  // Raw Imports
  plugins.push(await importAttributes(nitro), raw());

  // Route meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(await routeMeta(nitro));
  }

  // Replace
  plugins.push(replace(base.replacements));

  // Externals (require Node.js compatible resolution)
  if (nitro.options.node && nitro.options.noExternals !== true) {
    const isDevOrPrerender = nitro.options.dev || nitro.options.preset === "nitro-prerender";
    plugins.push(
      externals({
        rootDir: nitro.options.rootDir,
        conditions: nitro.options.exportConditions!,
        include: nitro.options.traceDeps || [],
        exclude: [...base.noExternal],
        trace: isDevOrPrerender
          ? false
          : {
              // `nitro/types` has its own bundled copy of the `nf3` types
              ...(nitro.options.traceOpts as Partial<ExternalsTraceOptions>),
              outDir: nitro.options.output.serverDir,
            },
      })
    );
  }

  // Sourcemap
  if (nitro.options.sourcemap && !nitro.options.dev) {
    plugins.push(
      sourcemap({
        virtualIds: virtualPlugin.api.modules.keys(),
        minify: nitro.options.experimental.sourcemapMinify !== false,
      })
    );
  }

  return plugins;
}

/** Nitro's `plugins` wrapped with the `buildPlugins` (ordered by `enforce`). */
export async function withBuildPlugins<T>(nitro: Nitro, plugins: T[]): Promise<T[]> {
  const buildPlugins = await resolveBuildPlugins(nitro);
  const byEnforce = (enforce?: "pre" | "post") =>
    buildPlugins.filter((p) => p.enforce === enforce) as T[];
  return [...byEnforce("pre"), ...plugins, ...byEnforce(), ...byEnforce("post")];
}

/** Flattened `buildPlugins` (nested arrays and promises resolved, falsy entries skipped). */
export async function resolveBuildPlugins(nitro: Nitro): Promise<NitroBuildPlugin[]> {
  return flatPlugins(nitro.options.buildPlugins || []);
}

/** Flattened plugin options (nested arrays and promises resolved, falsy entries skipped). */
export async function flatPlugins(options: NitroBuildPluginOption[]): Promise<NitroBuildPlugin[]> {
  const plugins: NitroBuildPlugin[] = [];
  for (const entry of options) {
    const option = await entry;
    if (Array.isArray(option)) {
      plugins.push(...(await flatPlugins(option)));
    } else if (option) {
      plugins.push(option);
    }
  }
  return plugins;
}
