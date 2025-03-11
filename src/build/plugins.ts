import type { Nitro, NodeExternalsOptions } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config";
import { pathToFileURL } from "node:url";
import { builtinModules } from "node:module";
import { isAbsolute, dirname } from "pathe";
import { hash } from "ohash";
import { defu } from "defu";
import { resolveModulePath } from "exsolve";
import { isTest } from "std-env";
import { runtimeDir, runtimeDependencies } from "nitro/runtime/meta";
import unimportPlugin from "unimport/unplugin";
import { rollup as unwasm } from "unwasm/plugin";
import { database } from "./plugins/database";
import { handlers } from "./plugins/handlers";
import { handlersMeta } from "./plugins/handlers-meta";
import { publicAssets } from "./plugins/public-assets";
import { raw } from "./plugins/raw";
import { serverAssets } from "./plugins/server-assets";
import { storage } from "./plugins/storage";
import { timing } from "./plugins/timing";
import { virtual } from "./plugins/virtual";
import { errorHandler } from "./plugins/error-handler";
import { externals } from "./plugins/externals";

export function baseBuildPlugins(nitro: Nitro, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Server timing
  if (nitro.options.timing) {
    plugins.push(
      timing({
        silent: isTest,
      })
    );
  }

  // Auto imports
  if (nitro.options.imports) {
    plugins.push(unimportPlugin.rollup(nitro.options.imports) as Plugin);
  }

  // Raw asset loader
  plugins.push(raw());

  // WASM loader
  if (nitro.options.experimental.wasm) {
    plugins.push(unwasm(nitro.options.wasm || {}));
  }

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

  // Server assets
  plugins.push(serverAssets(nitro));

  // Public assets
  plugins.push(publicAssets(nitro));

  // Storage
  plugins.push(storage(nitro));

  // Database
  plugins.push(database(nitro));

  // Handlers
  plugins.push(handlers(nitro));

  // Handlers meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(handlersMeta(nitro));
  }

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
      nitro.vfs
    )
  );

  // User virtuals
  plugins.push(virtual(nitro.options.virtual, nitro.vfs));

  // Externals Plugin
  if (nitro.options.noExternals) {
    plugins.push({
      name: "no-externals",
      async resolveId(id, importer, resolveOpts) {
        id = base.aliases[id] || id;
        if (
          base.env.external.includes(id) ||
          (nitro.options.node &&
            (id.startsWith("node:") || builtinModules.includes(id)))
        ) {
          return { id, external: true };
        }
        const resolved = await this.resolve(id, importer, resolveOpts);
        if (!resolved) {
          const _resolved = resolveModulePath(id, {
            try: true,
            from:
              importer && isAbsolute(importer)
                ? [pathToFileURL(importer), ...nitro.options.nodeModulesDirs]
                : nitro.options.nodeModulesDirs,
            suffixes: ["", "/index"],
            extensions: [".mjs", ".cjs", ".js", ".mts", ".cts", ".ts", ".json"],
            conditions: [
              "default",
              nitro.options.dev ? "development" : "production",
              "node",
              "import",
              "require",
            ],
          });
          if (_resolved) {
            return { id: _resolved, external: false };
          }
        }
        if (!resolved || (resolved.external && !id.endsWith(".wasm"))) {
          throw new Error(
            `Cannot resolve ${JSON.stringify(id)} from ${JSON.stringify(
              importer
            )} and externals are not allowed!`
          );
        }
      },
    });
  } else {
    plugins.push(
      externals(
        defu(nitro.options.externals, <NodeExternalsOptions>{
          outDir: nitro.options.output.serverDir,
          moduleDirectories: nitro.options.nodeModulesDirs,
          external: [
            ...(nitro.options.dev ? [nitro.options.buildDir] : []),
            ...nitro.options.nodeModulesDirs,
          ],
          inline: [
            "#",
            "~",
            "@/",
            "~~",
            "@@/",
            "virtual:",
            "nitro/runtime",
            "nitro/runtime",
            dirname(nitro.options.entry),
            ...(nitro.options.experimental.wasm
              ? [(id: string) => id?.endsWith(".wasm")]
              : []),
            runtimeDir,
            nitro.options.srcDir,
            ...nitro.options.handlers
              .map((m) => m.handler)
              .filter((i) => typeof i === "string"),
            ...(nitro.options.dev ||
            nitro.options.preset === "nitro-prerender" ||
            nitro.options.experimental.bundleRuntimeDependencies === false
              ? []
              : runtimeDependencies),
          ],
          traceOptions: {
            base: "/",
            processCwd: nitro.options.rootDir,
            exportsOnly: true,
          },
          traceAlias: {
            "h3-nightly": "h3",
            ...nitro.options.externals?.traceAlias,
          },
          exportConditions: nitro.options.exportConditions,
        })
      )
    );
  }

  return plugins;
}
