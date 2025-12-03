import type { Nitro, NodeExternalsOptions } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";
import { defu } from "defu";
import unimportPlugin from "unimport/unplugin";
import { unwasm } from "unwasm/plugin";
import replace from "@rollup/plugin-replace";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { virtual } from "./plugins/virtual.ts";
import { rollupNodeFileTrace } from "nf3";
import { nitroResolveIds } from "./plugins/resolve.ts";
import { sourcemapMinify } from "./plugins/sourcemap-min.ts";
import { raw } from "./plugins/raw.ts";
import { serverEntryExports } from "./plugins/server-entry-exports.ts";

import { virtualTemplates } from "./virtual/_all.ts";

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

  // Server entry re-exports
  plugins.push(serverEntryExports(nitro));

  // Virtual templates
  const virtualPlugin = virtual(
    virtualTemplates(nitro, [...base.env.polyfill])
  );
  nitro.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin);

  // Replace Plugin
  plugins.push(
    (replace as unknown as typeof replace.default)({
      preventAssignment: true,
      values: base.replacements,
    })
  );

  // Externals Plugin
  if (!nitro.options.noExternals) {
    plugins.push(
      rollupNodeFileTrace(
        defu(nitro.options.externals, {
          outDir: nitro.options.output.serverDir,
          moduleDirectories: nitro.options.nodeModulesDirs,
          external: nitro.options.nodeModulesDirs,
          inline: [...base.noExternal],
          traceOptions: {
            base: "/",
            processCwd: nitro.options.rootDir,
            exportsOnly: true,
          },
          traceAlias: {
            "h3-nightly": "h3",
            ...nitro.options.externals?.traceAlias,
          },
          exportConditions: nitro.options.exportConditions as string[],
          writePackageJson: true,
        } satisfies NodeExternalsOptions)
      )
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
