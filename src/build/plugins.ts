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
import { raw, RESOLVED_RE as rawModulesRE } from "./plugins/raw.ts";
import { importAttributes } from "./plugins/import-attributes.ts";
import { externals } from "./plugins/externals.ts";

export async function baseBuildPlugins(nitro: Nitro, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Virtual
  const virtualPlugin = virtual(virtualTemplates(nitro, [...base.env.polyfill]));
  nitro.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin, virtualDeps());

  // Auto imports
  if (nitro.options.imports) {
    const unimportPlugin = await import("unimport/unplugin");
    plugins.push(unimportPlugin.default.rollup(nitro.options.imports) as Plugin);
  }

  // WASM loader
  if (nitro.options.wasm !== false) {
    plugins.push(unwasm(nitro.options.wasm || {}));
  }

  // Inject globalThis.__server_main__
  plugins.push(serverMain(nitro));

  // Raw Imports
  plugins.push(await importAttributes(), raw());

  // Route meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(await routeMeta(nitro));
  }

  // Replace
  const replacePlugin = (replace as unknown as typeof replace.default)({
    preventAssignment: true,
    values: base.replacements,
    // Raw modules hold file contents as string literals; replacing inside them
    // corrupts the content (and can break the syntax with quoted values)
    exclude: rawModulesRE,
  });
  // The plugin re-applies replacements on whole chunks, where raw module contents
  // can no longer be excluded by id. All replaceable code goes through `transform`.
  delete replacePlugin.renderChunk;
  plugins.push(replacePlugin);

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
              ...nitro.options.traceOpts,
              outDir: nitro.options.output.serverDir,
            },
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
