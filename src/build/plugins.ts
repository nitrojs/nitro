import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";
import { hash } from "ohash";
import unimportPlugin from "unimport/unplugin";
import { unwasm } from "unwasm/plugin";
import replace from "@rollup/plugin-replace";
import { database } from "./plugins/database.ts";
import { routing } from "./plugins/routing.ts";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { publicAssets } from "./plugins/public-assets.ts";
import { serverAssets } from "./plugins/server-assets.ts";
import { storage } from "./plugins/storage.ts";
import { virtual } from "./plugins/virtual.ts";
import { errorHandler } from "./plugins/error-handler.ts";
// import { rollupNodeFileTrace } from "nf3";
import { rendererTemplate } from "./plugins/renderer-template.ts";
import { featureFlags } from "./plugins/feature-flags.ts";
import { nitroResolveIds } from "./plugins/resolve.ts";
import { sourcemapMinify } from "./plugins/sourcemap-min.ts";
import { raw } from "./plugins/raw.ts";
import { runtimeConfig } from "./plugins/runtime-config.ts";
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

  // Inject gloalThis.__server_main__
  plugins.push(serverMain(nitro));

  // Nitro Plugins
  const nitroPlugins = [...new Set(nitro.options.plugins)];
  plugins.push(
    virtual(
      {
        "#nitro-internal-virtual/plugins": /* js */ `
  ${nitroPlugins
    .map(
      (plugin) => `import _${hash(plugin).replace(/-/g, "")} from '${plugin}';`
    )
    .join("\n")}

  export const plugins = [
    ${nitroPlugins.map((plugin) => `_${hash(plugin).replace(/-/g, "")}`).join(",\n")}
  ]
      `,
      },
      nitro.vfs
    )
  );

  // Feature flags
  plugins.push(featureFlags(nitro));

  // Resolve imports from virtual files and mapped subpaths
  plugins.push(nitroResolveIds());

  // Server assets
  plugins.push(serverAssets(nitro));

  // Public assets
  plugins.push(publicAssets(nitro));

  // Storage
  plugins.push(storage(nitro));

  // Database
  plugins.push(database(nitro));

  // Routing
  plugins.push(routing(nitro));

  // Raw Imports
  plugins.push(raw());

  // Route meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(routeMeta(nitro));
  }

  // Runtime config
  plugins.push(runtimeConfig(nitro));

  // Error handler
  plugins.push(errorHandler(nitro));

  // Polyfill
  plugins.push(
    virtual(
      {
        "#nitro-internal-pollyfills":
          base.env.polyfill.map((p) => /* js */ `import '${p}';`).join("\n") ||
          /* js */ `/* No polyfills */`,
      },
      nitro.vfs,
      { moduleSideEffects: true }
    )
  );

  // User virtual templates
  plugins.push(virtual(nitro.options.virtual, nitro.vfs));

  // Renderer template
  if (nitro.options.renderer?.template) {
    plugins.push(rendererTemplate(nitro));
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
    plugins.push(
      externals({
        rootDir: nitro.options.rootDir,
        conditions: nitro.options.exportConditions || ["default"],
        exclude: [...base.noExternal],
        include: nitro.options.dev ? undefined : [],
        trace: nitro.options.dev
          ? false
          : { outDir: nitro.options.output.serverDir },
      })
    );
  }

  // Minify
  if (
    nitro.options.sourcemap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  ) {
    plugins.push(sourcemapMinify());
  }

  return plugins;
}
