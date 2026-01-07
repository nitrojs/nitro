import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";

import { virtualTemplates } from "./virtual/_all.ts";
import replace from "@rollup/plugin-replace";
import { unwasm } from "unwasm/plugin";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { virtual, virtualDeps } from "./plugins/virtual.ts";
import { sourcemapMinify } from "./plugins/sourcemap-min.ts";
import { raw } from "./plugins/raw.ts";
import { externals } from "./plugins/externals.ts";
import { NodeNativePackages } from "nf3";

export async function baseBuildPlugins(nitro: Nitro, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Virtual
  const virtualPlugin = virtual(
    virtualTemplates(nitro, [...base.env.polyfill])
  );
  nitro.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin, virtualDeps());

  // Auto imports
  if (nitro.options.imports) {
    const unimportPlugin = await import("unimport/unplugin");
    plugins.push(
      unimportPlugin.default.rollup(nitro.options.imports) as Plugin
    );
  }

  // WASM loader
  if (nitro.options.wasm !== false) {
    plugins.push(unwasm(nitro.options.wasm || {}));
  }

  // Inject globalThis.__server_main__
  plugins.push(serverMain(nitro));

  // Raw Imports
  plugins.push(raw());

  // Route meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(routeMeta(nitro));
  }

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
    const traceDeps = [
      ...new Set([...NodeNativePackages, ...(nitro.options.traceDeps || [])]),
    ];
    plugins.push(
      externals({
        rootDir: nitro.options.rootDir,
        conditions: nitro.options.exportConditions || ["default"],
        exclude: [...base.noExternal],
        include: isDevOrPrerender
          ? undefined
          : [
              new RegExp(
                `^(?:${traceDeps.join("|")})|[/\\\\]node_modules[/\\\\](?:${traceDeps.join("|")})(?:[/\\\\])`
              ),
            ],
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
