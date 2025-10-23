import type { Nitro, RollupConfig } from "nitro/types";
import type { Plugin } from "rollup";
import { createRequire } from "node:module";
import { defu } from "defu";
import { sanitizeFilePath } from "mlly";
import { normalize } from "pathe";
import { runtimeDir } from "nitro/runtime/meta";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { replace } from "../plugins/replace";
import { esbuild } from "../plugins/esbuild";
import { sourcemapMininify } from "../plugins/sourcemap-min";
import { baseBuildConfig } from "../config";
import { baseBuildPlugins } from "../plugins";
import { raw } from "../plugins/raw";

export const getRollupConfig = (nitro: Nitro): RollupConfig => {
  const base = baseBuildConfig(nitro);

  const chunkNamePrefixes = [
    [nitro.options.buildDir, "build"],
    [base.buildServerDir, "app"],
    [runtimeDir, "nitro"],
    [base.presetsDir, "nitro"],
    ["\0raw:", "raw"],
    ["\0nitro-wasm:", "wasm"],
    ["\0", "virtual"],
  ] as const;

  function getChunkGroup(id: string): string | void {
    if (id.startsWith(runtimeDir) || id.startsWith(base.presetsDir)) {
      return "nitro";
    }
  }

  let config = {
    input: nitro.options.entry,
    external: [...base.env.external],
    plugins: [
      ...baseBuildPlugins(nitro, base),
      esbuild({
        target: "esnext",
        sourceMap: nitro.options.sourceMap,
        ...nitro.options.esbuild?.options,
      }),
      alias({ entries: base.aliases }),
      replace({
        delimiters: base.replaceDelimiter,
        preventAssignment: true,
        values: base.replacements,
      }),
      nodeResolve({
        extensions: base.extensions,
        preferBuiltins: !!nitro.options.node,
        rootDir: nitro.options.rootDir,
        modulePaths: nitro.options.nodeModulesDirs,
        // 'module' is intentionally not supported because of externals
        mainFields: ["main"],
        exportConditions: nitro.options.exportConditions,
      }),
      commonjs({
        strictRequires: "auto", // TODO: set to true (default) in v3
        esmExternals: (id) => !id.startsWith("unenv/"),
        requireReturnsDefault: "auto",
        ...nitro.options.commonJS,
      }),
      json(),
      inject(base.env.inject),
      raw(),
    ],
    onwarn(warning, rollupWarn) {
      if (
        !["CIRCULAR_DEPENDENCY", "EVAL"].includes(warning.code || "") &&
        !warning.message.includes("Unsupported source map comment")
      ) {
        rollupWarn(warning);
      }
    },
    treeshake: {
      moduleSideEffects(id) {
        const normalizedId = normalize(id);
        const idWithoutNodeModules = normalizedId.split("node_modules/").pop();
        if (!idWithoutNodeModules) {
          return false;
        }
        if (
          normalizedId.startsWith(runtimeDir) ||
          idWithoutNodeModules.startsWith(runtimeDir)
        ) {
          return true;
        }
        return nitro.options.moduleSideEffects.some(
          (m) =>
            normalizedId.startsWith(m) || idWithoutNodeModules.startsWith(m)
        );
      },
    },
    output: {
      dir: nitro.options.output.serverDir,
      entryFileNames: "index.mjs",
      chunkFileNames(chunk) {
        const id = normalize(chunk.moduleIds.at(-1) || "");
        // Known path prefixes
        for (const [dir, name] of chunkNamePrefixes) {
          if (id.startsWith(dir)) {
            return `chunks/${name}/[name].mjs`;
          }
        }

        // Route handlers
        const routeHandler =
          nitro.options.handlers.find((h) =>
            id.startsWith(h.handler as string)
          ) ||
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
      },
      manualChunks(id) {
        return getChunkGroup(id);
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
      sourcemapIgnoreList(relativePath) {
        return relativePath.includes("node_modules");
      },
    },
  } satisfies RollupConfig;

  config = defu(nitro.options.rollupConfig as any, config);

  if (config.output.inlineDynamicImports) {
    // @ts-ignore
    delete config.output.manualChunks;
  }

  // Minify
  if (nitro.options.minify) {
    const _terser = createRequire(import.meta.url)("@rollup/plugin-terser");
    const terser = _terser.default || _terser;
    config.plugins.push(
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
  if (
    nitro.options.sourceMap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  ) {
    config.plugins.push(sourcemapMininify());
  }

  return config;
};
