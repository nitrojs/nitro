import type { Nitro, RollupConfig } from "nitro/types";
import { defu } from "defu";
import { sanitizeFilePath } from "mlly";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { oxc } from "../plugins/oxc.ts";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins } from "../plugins.ts";
import { getChunkName } from "../chunks.ts";

export const getRollupConfig = (nitro: Nitro): RollupConfig => {
  const base = baseBuildConfig(nitro);

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
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk) => getChunkName(chunk, nitro),
      dir: nitro.options.output.serverDir,
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      generatedCode: { constBindings: true },
      sanitizeFileName: sanitizeFilePath,
      sourcemap: nitro.options.sourcemap,
      sourcemapExcludeSources: true,
      sourcemapIgnoreList: (id) => id.includes("node_modules"),
    },
  } satisfies RollupConfig;

  config = defu(nitro.options.rollupConfig as any, config);

  return config;
};
