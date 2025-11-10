import type { Nitro, RollupConfig } from "nitro/types";
import { defu } from "defu";
import { sanitizeFilePath } from "mlly";
import { normalize } from "pathe";
import { runtimeDir } from "nitro/meta";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { replace } from "../plugins/replace.ts";
import { oxc } from "../plugins/oxc.ts";
import { sourcemapMinify } from "../plugins/sourcemap-min.ts";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins } from "../plugins.ts";
import { raw } from "../plugins/raw.ts";

export const getRollupConfig = (nitro: Nitro): RollupConfig => {
  const base = baseBuildConfig(nitro);

  const chunkNamePrefixes = [
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

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  let config = {
    input: nitro.options.entry,
    external: [...base.env.external],
    plugins: [
      ...baseBuildPlugins(nitro, base),
      oxc({
        sourcemap: !!nitro.options.sourcemap,
        minify: nitro.options.minify ? { ...nitro.options.oxc?.minify } : false,
        transform: {
          target: "esnext",
          cwd: nitro.options.rootDir,
          ...nitro.options.oxc?.transform,
          jsx: {
            runtime: tsc?.jsx === "react" ? "classic" : "automatic",
            pragma: tsc?.jsxFactory,
            pragmaFrag: tsc?.jsxFragmentFactory,
            importSource: tsc?.jsxImportSource,
            development: nitro.options.dev,
            ...nitro.options.oxc?.transform?.jsx,
          },
        },
      }),
      alias({ entries: base.aliases }),
      replace({
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
      (commonjs as unknown as typeof commonjs.default)({
        ...nitro.options.commonJS,
      }),
      (json as unknown as typeof json.default)(),
      (inject as unknown as typeof inject.default)(base.env.inject),
      raw(),
    ],
    onwarn(warning, rollupWarn) {
      if (
        !["EVAL", "CIRCULAR_DEPENDENCY", "THIS_IS_UNDEFINED"].includes(
          warning.code || ""
        ) &&
        !warning.message.includes("Unsupported source map comment")
      ) {
        rollupWarn(warning);
      }
    },
    treeshake: {
      moduleSideEffects(id) {
        return nitro.options.moduleSideEffects.some((p) => id.startsWith(p));
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
      sourcemap: nitro.options.sourcemap,
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
  if (
    nitro.options.sourcemap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  ) {
    config.plugins.push(sourcemapMinify());
  }

  return config;
};
