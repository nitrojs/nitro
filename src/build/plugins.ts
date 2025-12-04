import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";

import { virtualTemplates } from "./virtual/_all.ts";
import unimportPlugin from "unimport/unplugin";
import replace from "@rollup/plugin-replace";
import { unwasm } from "unwasm/plugin";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { virtual } from "./plugins/virtual.ts";
import { nitroResolveIds } from "./plugins/resolve.ts";
import { sourcemapMinify } from "./plugins/sourcemap-min.ts";
import { raw } from "./plugins/raw.ts";
import { externals } from "./plugins/externals.ts";

export function baseBuildPlugins(nitro: Nitro, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Auto imports
  if (nitro.options.imports) {
    plugins.push(unimportPlugin.rollup(nitro.options.imports) as Plugin);
  }

  // WASM loader
  if (nitro.options.wasm !== false) {
    plugins.push(unwasm(nitro.options.wasm || {}));
  }

  // Inject globalThis.__server_main__
  plugins.push(serverMain(nitro));

  // Resolve imports from virtual files and mapped subpaths
  plugins.push(nitroResolveIds());

  // Raw Imports
  plugins.push(raw());

  // Route meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(routeMeta(nitro));
  }

  // Virtual templates
  const virtualPlugin = virtual(
    virtualTemplates(nitro, [...base.env.polyfill])
  );
  nitro.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin);

  // Replace
  plugins.push(
    (replace as unknown as typeof replace.default)({
      preventAssignment: true,
      values: base.replacements,
    })
  );

  // Externals (require Node.js compatible resolution)
  if (nitro.options.node && nitro.options.noExternals !== true) {
    const isDevOrPrerender =
      nitro.options.dev || nitro.options.preset === "nitro-prerender";
    plugins.push(
      externals({
        rootDir: nitro.options.rootDir,
        conditions: nitro.options.exportConditions || ["default"],
        exclude: [...base.noExternal],
        include: isDevOrPrerender ? undefined : nitro.options.traceDeps,
        trace: isDevOrPrerender
          ? false
          : { outDir: nitro.options.output.serverDir },
      })
    );
  }

  // Sourcemap minify
  if (
    nitro.options.sourcemap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  ) {
    plugins.push(sourcemapMinify());
  }

  return plugins;
}
