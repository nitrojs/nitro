import type {
  Nitro,
  NitroStaticBuildFlags,
  NodeExternalsOptions,
} from "nitro/types";
import type { Plugin } from "rollup";
import { pathToFileURL } from "node:url";
import { builtinModules } from "node:module";
import { isAbsolute, join, dirname, resolve } from "pathe";
import { hash } from "ohash";
import { defu } from "defu";
import { resolveModulePath } from "exsolve";
import { isTest, isWindows } from "std-env";
import { defineEnv } from "unenv";
import { runtimeDir, runtimeDependencies } from "nitro/runtime/meta";
import unimportPlugin from "unimport/unplugin";
import { rollup as unwasm } from "unwasm/plugin";
import { database } from "./plugins/database";
import { handlers } from "./plugins/handlers";
import { handlersMeta } from "./plugins/handlers-meta";
import { importMeta } from "./plugins/import-meta";
import { publicAssets } from "./plugins/public-assets";
import { raw } from "./plugins/raw";
import { serverAssets } from "./plugins/server-assets";
import { storage } from "./plugins/storage";
import { timing } from "./plugins/timing";
import { virtual } from "./plugins/virtual";
import { errorHandler } from "./plugins/error-handler";
import { externals } from "./plugins/externals";

export function baseRollupPlugins(
  nitro: Nitro,
  base: ReturnType<typeof baseRollupConfig>
) {
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

  // Universal import.meta
  plugins.push(importMeta(nitro));

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

export function baseRollupConfig(nitro: Nitro) {
  const buildServerDir = join(nitro.options.buildDir, "dist/server");
  const presetsDir = resolve(runtimeDir, "../presets");

  // prettier-ignore
  const extensions: string[] = [".ts", ".mjs", ".js", ".json", ".node", ".tsx", ".jsx" ];

  const isNodeless = nitro.options.node === false;

  // Build-time environment variables
  let NODE_ENV = nitro.options.dev ? "development" : "production";
  if (nitro.options.preset === "nitro-prerender") {
    NODE_ENV = "prerender";
  }

  const buildEnvVars = {
    NODE_ENV,
    prerender: nitro.options.preset === "nitro-prerender",
    server: true,
    client: false,
    dev: String(nitro.options.dev),
    DEBUG: nitro.options.dev,
  };

  const staticFlags: NitroStaticBuildFlags = {
    dev: nitro.options.dev,
    preset: nitro.options.preset,
    prerender: nitro.options.preset === "nitro-prerender",
    server: true,
    client: false,
    nitro: true,
    baseURL: nitro.options.baseURL,
    // @ts-expect-error
    "versions.nitro": "",
    "versions?.nitro": "",
    // Internal
    _asyncContext: nitro.options.experimental.asyncContext,
    _websocket: nitro.options.experimental.websocket,
    _tasks: nitro.options.experimental.tasks,
  };

  const replacements = {
    "typeof window": '"undefined"',
    _import_meta_url_: "import.meta.url",
    "globalThis.process.": "process.",
    "process.env.RUNTIME_CONFIG": () =>
      JSON.stringify(nitro.options.runtimeConfig, null, 2),
    ...Object.fromEntries(
      [".", ";", ")", "[", "]", "}", " "].map((d) => [
        `import.meta${d}`,
        `globalThis._importMeta_${d}`,
      ])
    ),
    ...Object.fromEntries(
      [";", "(", "{", "}", " ", "\t", "\n"].map((d) => [
        `${d}global.`,
        `${d}globalThis.`,
      ])
    ),
    ...Object.fromEntries(
      Object.entries(buildEnvVars).map(([key, val]) => [
        `process.env.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(buildEnvVars).map(([key, val]) => [
        `import.meta.env.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(staticFlags).map(([key, val]) => [
        `process.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(staticFlags).map(([key, val]) => [
        `import.meta.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...nitro.options.replace,
  };

  const { env } = defineEnv({
    nodeCompat: isNodeless,
    npmShims: true,
    resolve: true,
    presets: nitro.options.unenv,
    overrides: {
      alias: nitro.options.alias,
    },
  });

  let buildDir = nitro.options.buildDir;
  // Windows (native) dynamic imports should be file:// urls
  if (
    isWindows &&
    nitro.options.externals?.trace === false &&
    nitro.options.dev
  ) {
    buildDir = pathToFileURL(buildDir).href;
  }

  const aliases = resolveAliases({
    "#build": buildDir,
    "#internal/nitro": runtimeDir,
    "nitro/runtime": runtimeDir,
    "nitropack/runtime": runtimeDir, // Backwards compatibility
    "~": nitro.options.srcDir,
    "@/": nitro.options.srcDir,
    "~~": nitro.options.rootDir,
    "@@/": nitro.options.rootDir,
    ...env.alias,
  });

  return {
    buildDir,
    buildServerDir,
    presetsDir,
    extensions,
    isNodeless,
    buildEnvVars,
    staticFlags,
    replacements,
    env,
    aliases,
  };
}

export function resolveAliases(_aliases: Record<string, string>) {
  // Sort aliases from specific to general (ie. fs/promises before fs)
  const aliases = Object.fromEntries(
    Object.entries(_aliases).sort(
      ([a], [b]) =>
        b.split("/").length - a.split("/").length || b.length - a.length
    )
  );
  // Resolve alias values in relation to each other
  for (const key in aliases) {
    for (const alias in aliases) {
      if (!["~", "@", "#"].includes(alias[0])) {
        continue;
      }
      if (alias === "@" && !aliases[key].startsWith("@/")) {
        continue;
      } // Don't resolve @foo/bar

      if (aliases[key].startsWith(alias)) {
        aliases[key] = aliases[alias] + aliases[key].slice(alias.length);
      }
    }
  }
  return aliases;
}
