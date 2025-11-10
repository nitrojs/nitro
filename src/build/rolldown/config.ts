import type { Nitro } from "nitro/types";
import type { RolldownOptions, RolldownPlugin } from "rolldown";
import { sanitizeFilePath } from "mlly";
import { normalize } from "pathe";
import { runtimeDir } from "nitro/meta";
import { baseBuildConfig } from "../config.ts";
import { baseBuildPlugins } from "../plugins.ts";
import { replace } from "../plugins/replace.ts";
import { builtinModules } from "node:module";
import { defu } from "defu";

export const getRolldownConfig = (nitro: Nitro): RolldownOptions => {
  const base = baseBuildConfig(nitro);

  const chunkNamePrefixes = [
    [runtimeDir, "nitro"],
    [base.presetsDir, "nitro"],
    ["\0raw:", "raw"],
    ["\0nitro-wasm:", "wasm"],
    ["\0", "virtual"],
  ] as const;

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;

  let config = {
    cwd: nitro.options.rootDir,
    input: nitro.options.entry,
    external: [
      ...base.env.external,
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
    ],
    plugins: [
      ...(baseBuildPlugins(nitro, base) as RolldownPlugin[]),
      // https://github.com/rolldown/rolldown/issues/4257
      replace({
        preventAssignment: true,
        values: base.replacements,
      }) as RolldownPlugin,
    ],
    resolve: {
      alias: base.aliases,
      extensions: base.extensions,
      mainFields: ["main"], // "module" is intentionally not supported because of externals
      conditionNames: nitro.options.exportConditions,
    },
    transform: {
      inject: base.env.inject as Record<string, string>,
      jsx: {
        runtime: tsc?.jsx === "react" ? "classic" : "automatic",
        pragma: tsc?.jsxFactory,
        pragmaFrag: tsc?.jsxFragmentFactory,
        importSource: tsc?.jsxImportSource,
        development: nitro.options.dev,
      },
    },
    onwarn(warning, warn) {
      if (
        !["CIRCULAR_DEPENDENCY", "EVAL"].includes(warning.code || "") &&
        !warning.message.includes("Unsupported source map comment")
      ) {
        warn(warning);
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
      minify: nitro.options.minify,
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
              .replace(/\/[^/]+$/g, "")
              .replace(/[^a-zA-Z0-9/_-]/g, "_") || "/";
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
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      format: "esm",
      exports: "auto",
      intro: "",
      outro: "",
      sanitizeFileName: sanitizeFilePath,
      sourcemap: nitro.options.sourcemap,
      sourcemapIgnoreList(relativePath) {
        return relativePath.includes("node_modules");
      },
    },
  } satisfies RolldownOptions;

  config = defu(nitro.options.rollupConfig as any, config);

  return config as RolldownOptions;
};
