import { pathToFileURL } from "node:url";
import { createRequire, builtinModules } from "node:module";
import { join, normalize, resolve } from "pathe";
import type { InputOptions, OutputOptions, Plugin } from "rollup";
import { defu } from "defu";
// import terser from "@rollup/plugin-terser"; // TODO: Investigate jiti issue
import commonjs from "@rollup/plugin-commonjs";
import alias from "@rollup/plugin-alias";
import json from "@rollup/plugin-json";
import inject from "@rollup/plugin-inject";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { isWindows } from "std-env";
import { visualizer } from "rollup-plugin-visualizer";
import * as unenv from "unenv";
import type { Preset } from "unenv";
import { sanitizeFilePath, resolvePath } from "mlly";
import unimportPlugin from "unimport/unplugin";
import { hash } from "ohash";
import { rollup as unwasm } from "unwasm/plugin";
import type { Nitro, NitroStaticBuildFlags } from "../types";
import { resolveAliases } from "../utils";
import { runtimeDir } from "../dirs";
import nitroPkg from "../../package.json";
import { nitroRuntimeDependencies } from "../deps";
import { replace } from "./plugins/replace";
import { virtual } from "./plugins/virtual";
import { dynamicRequire } from "./plugins/dynamic-require";
import { NodeExternalsOptions, externals } from "./plugins/externals";
import { externals as legacyExternals } from "./plugins/externals-legacy";
import { timing } from "./plugins/timing";
import { publicAssets } from "./plugins/public-assets";
import { serverAssets } from "./plugins/server-assets";
import { handlers } from "./plugins/handlers";
import { esbuild } from "./plugins/esbuild";
import { raw } from "./plugins/raw";
import { storage } from "./plugins/storage";
import { database } from "./plugins/database";
import { importMeta } from "./plugins/import-meta";
import { appConfig } from "./plugins/app-config";
import { sourcemapMininify } from "./plugins/sourcemap-min";

export type RollupConfig = InputOptions & { output: OutputOptions };

export const getRollupConfig = (nitro: Nitro): RollupConfig => {
  const extensions: string[] = [".ts", ".mjs", ".js", ".json", ".node"];

  const nodePreset = nitro.options.node === false ? unenv.nodeless : unenv.node;

  const builtinPreset: Preset = {
    alias: {
      // General
      ...(nitro.options.dev
        ? {}
        : {
            debug: "unenv/runtime/npm/debug",
            "consola/core": "consola/core",
            consola: "unenv/runtime/npm/consola",
          }),
      ...nitro.options.alias,
    },
  };

  const env = unenv.env(nodePreset, builtinPreset, nitro.options.unenv);

  const buildServerDir = join(nitro.options.buildDir, "dist/server");

  const chunkNamePrefixes = [
    [nitro.options.buildDir, "build"],
    [buildServerDir, "app"],
    ["\0raw:", "raw"],
    ["\0nitro-wasm:", "wasm"],
    ["\0", "virtual"],
  ] as const;
  function getChunkName(id: string) {
    // Runtime
    if (id.startsWith(runtimeDir)) {
      return `chunks/runtime.mjs`;
    }

    // Known path prefixes
    for (const [dir, name] of chunkNamePrefixes) {
      if (id.startsWith(dir)) {
        return `chunks/${name}/[name].mjs`;
      }
    }

    // Route handlers
    const routeHandler =
      nitro.options.handlers.find((h) => id.startsWith(h.handler as string)) ||
      nitro.scannedHandlers.find((h) => id.startsWith(h.handler as string));
    if (routeHandler?.route) {
      const path =
        routeHandler.route
          .replace(/:([^/]+)/g, "_$1")
          .replace(/\/[^/]+$/g, "") || "/";
      return `chunks/routes${path}/[name].mjs`;
    }

    // Task handlers
    const taskHandler = Object.entries(nitro.options.tasks).find(
      ([_, task]) => task.handler === id
    );
    if (taskHandler) {
      return `chunks/tasks/[name].mjs`;
    }

    // Unknown path
    return `chunks/_/[name].mjs`;
  }

  type _RollupConfig = Omit<RollupConfig, "plugins"> & { plugins: Plugin[] };

  const rollupConfig: _RollupConfig = defu(nitro.options.rollupConfig as any, <
    _RollupConfig
  >{
    input: nitro.options.entry,
    output: {
      dir: nitro.options.output.serverDir,
      entryFileNames: "index.mjs",
      chunkFileNames(chunk) {
        const lastModule = normalize(chunk.moduleIds.at(-1));
        return getChunkName(lastModule);
      },
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      format: "esm",
      exports: "auto",
      intro: "",
      outro: "",
      generatedCode: {
        constBindings: true,
      },
      sanitizeFileName: sanitizeFilePath,
      sourcemap: nitro.options.sourceMap,
      sourcemapExcludeSources: true,
      sourcemapIgnoreList(relativePath, sourcemapPath) {
        return relativePath.includes("node_modules");
      },
    },
    external: env.external,
    plugins: [],
    onwarn(warning, rollupWarn) {
      if (
        !["CIRCULAR_DEPENDENCY", "EVAL"].includes(warning.code) &&
        !warning.message.includes("Unsupported source map comment")
      ) {
        rollupWarn(warning);
      }
    },
    treeshake: {
      moduleSideEffects(id) {
        const normalizedId = normalize(id);
        const idWithoutNodeModules = normalizedId.split("node_modules/").pop();
        return nitro.options.moduleSideEffects.some(
          (m) =>
            normalizedId.startsWith(m) || idWithoutNodeModules.startsWith(m)
        );
      },
    },
  });

  if (nitro.options.timing) {
    rollupConfig.plugins.push(timing());
  }

  if (nitro.options.imports) {
    rollupConfig.plugins.push(
      unimportPlugin.rollup(nitro.options.imports) as Plugin
    );
  }

  // Raw asset loader
  rollupConfig.plugins.push(raw());

  // WASM support
  if (nitro.options.experimental.wasm) {
    rollupConfig.plugins.push(unwasm(nitro.options.wasm || {}));
  }

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
    // @ts-expect-error
    "versions.nitro": nitroPkg.version,
    "versions?.nitro": nitroPkg.version,
    // Internal
    _asyncContext: nitro.options.experimental.asyncContext,
    _websocket: nitro.options.experimental.websocket,
    _tasks: nitro.options.experimental.tasks,
  };

  // Universal import.meta
  rollupConfig.plugins.push(importMeta(nitro));

  // https://github.com/rollup/plugins/tree/master/packages/replace
  rollupConfig.plugins.push(
    replace({
      preventAssignment: true,
      values: {
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
      },
    })
  );

  // esbuild
  rollupConfig.plugins.push(
    esbuild({
      target: "es2019",
      sourceMap: nitro.options.sourceMap,
      ...nitro.options.esbuild?.options,
    })
  );

  // Dynamic Require Support
  rollupConfig.plugins.push(
    dynamicRequire({
      dir: resolve(nitro.options.buildDir, "dist/server"),
      inline:
        nitro.options.node === false || nitro.options.inlineDynamicImports,
      ignore: [
        "client.manifest.mjs",
        "server.js",
        "server.cjs",
        "server.mjs",
        "server.manifest.mjs",
      ],
    })
  );

  // Server assets
  rollupConfig.plugins.push(serverAssets(nitro));

  // Public assets
  rollupConfig.plugins.push(publicAssets(nitro));

  // Storage
  rollupConfig.plugins.push(storage(nitro));

  // Database
  if (nitro.options.experimental.database) {
    rollupConfig.plugins.push(database(nitro));
  }

  // App.config
  rollupConfig.plugins.push(appConfig(nitro));

  // Handlers
  rollupConfig.plugins.push(handlers(nitro));

  // Polyfill
  rollupConfig.plugins.push(
    virtual(
      {
        "#internal/nitro/virtual/polyfill": env.polyfill
          .map((p) => `import '${p}';`)
          .join("\n"),
      },
      nitro.vfs
    )
  );

  // User virtuals
  rollupConfig.plugins.push(virtual(nitro.options.virtual, nitro.vfs));

  // Plugins
  rollupConfig.plugins.push(
    virtual(
      {
        "#internal/nitro/virtual/plugins": `
${nitro.options.plugins
  .map((plugin) => `import _${hash(plugin)} from '${plugin}';`)
  .join("\n")}

export const plugins = [
  ${nitro.options.plugins.map((plugin) => `_${hash(plugin)}`).join(",\n")}
]
    `,
      },
      nitro.vfs
    )
  );

  // https://github.com/rollup/plugins/tree/master/packages/alias
  let buildDir = nitro.options.buildDir;
  // Windows (native) dynamic imports should be file:// urls
  if (
    isWindows &&
    nitro.options.externals?.trace === false &&
    nitro.options.dev
  ) {
    buildDir = pathToFileURL(buildDir).href;
  }
  rollupConfig.plugins.push(
    alias({
      entries: resolveAliases({
        "#build": buildDir,
        "#internal/nitro/virtual/error-handler": nitro.options.errorHandler,
        "~": nitro.options.srcDir,
        "@/": nitro.options.srcDir,
        "~~": nitro.options.rootDir,
        "@@/": nitro.options.rootDir,
        ...env.alias,
      }),
    })
  );

  // Externals Plugin
  if (nitro.options.noExternals) {
    rollupConfig.plugins.push({
      name: "no-externals",
      async resolveId(id, from, options) {
        if (
          nitro.options.node &&
          (id.startsWith("node:") || builtinModules.includes(id))
        ) {
          return { id, external: true };
        }
        const resolved = await this.resolve(id, from, options);
        if (!resolved) {
          const _resolved = await resolvePath(id, {
            url: nitro.options.nodeModulesDirs,
            conditions: [
              "default",
              nitro.options.dev ? "development" : "production",
              "node",
              "import",
              "require",
            ],
          }).catch(() => null);
          if (_resolved) {
            return { id: _resolved, external: false };
          }
        }
        if (!resolved || (resolved.external && !id.endsWith(".wasm"))) {
          throw new Error(
            `Cannot resolve ${JSON.stringify(id)} from ${JSON.stringify(
              from
            )} and externals are not allowed!`
          );
        }
      },
    });
  } else {
    const externalsPlugin = nitro.options.experimental.legacyExternals
      ? legacyExternals
      : externals;
    rollupConfig.plugins.push(
      externalsPlugin(
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
            ...(nitro.options.experimental.wasm
              ? [(id) => id.endsWith(".wasm")]
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
              : nitroRuntimeDependencies),
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

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  rollupConfig.plugins.push(
    nodeResolve({
      extensions,
      preferBuiltins: !!nitro.options.node,
      rootDir: nitro.options.rootDir,
      modulePaths: nitro.options.nodeModulesDirs,
      // 'module' is intentionally not supported because of externals
      mainFields: ["main"],
      exportConditions: nitro.options.exportConditions,
    })
  );

  // Automatically mock unresolved externals
  // rollupConfig.plugins.push(autoMock())

  // https://github.com/rollup/plugins/tree/master/packages/commonjs
  rollupConfig.plugins.push(
    commonjs({
      esmExternals: (id) => !id.startsWith("unenv/"),
      requireReturnsDefault: "auto",
      ...nitro.options.commonJS,
    })
  );

  // https://github.com/rollup/plugins/tree/master/packages/json
  rollupConfig.plugins.push(json());

  // https://github.com/rollup/plugins/tree/master/packages/inject
  rollupConfig.plugins.push(inject(env.inject));

  // https://www.npmjs.com/package/@rollup/plugin-terser
  // https://github.com/terser/terser#minify-options
  if (nitro.options.minify) {
    const _terser = createRequire(import.meta.url)("@rollup/plugin-terser");
    const terser = _terser.default || _terser;
    rollupConfig.plugins.push(
      terser({
        mangle: {
          keep_fnames: true,
          keep_classnames: true,
        },
        format: {
          comments: false,
        },
      })
    );
  }

  // Minify sourcemaps
  if (
    nitro.options.sourceMap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  ) {
    rollupConfig.plugins.push(sourcemapMininify());
  }

  if (nitro.options.analyze) {
    // https://github.com/btd/rollup-plugin-visualizer
    rollupConfig.plugins.push(
      visualizer({
        ...nitro.options.analyze,
        filename: nitro.options.analyze.filename.replace("{name}", "nitro"),
        title: "Nitro Server bundle stats",
      })
    );
  }

  return rollupConfig;
};
