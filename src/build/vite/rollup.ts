import type { Nitro, RollupConfig } from "nitro/types";
import { defu } from "defu";
import { sanitizeFilePath } from "mlly";
import { normalize } from "pathe";
import { runtimeDir } from "nitro/runtime/meta";
import alias from "@rollup/plugin-alias";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import { visualizer } from "rollup-plugin-visualizer";
import { replace } from "../plugins/replace";
import { baseBuildConfig, type BaseBuildConfig } from "../config";
import { baseBuildPlugins } from "../plugins";

/**
 * Removed from base rollup config:
 *  - nodeResolve
 *  - commonjs
 *  - esbuild
 *  - sourcemapMininify
 *
 * TODO: Reuse with rollup:
 * - chunkFileNames
 * - moduleSideEffects
 * - visualizer
 */

export const getViteRollupConfig = (
  nitro: Nitro
): { config: RollupConfig; base: BaseBuildConfig } => {
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
      alias({ entries: base.aliases }),
      replace({ preventAssignment: true, values: base.replacements }),
      json(),
      inject(base.env.inject),
    ],
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
          return `chunks/routes/${path}/[name].mjs`.replace(/\/+/g, "/");
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

  // Bundle analyzer
  if (nitro.options.analyze) {
    config.plugins.push(
      // https://github.com/btd/rollup-plugin-visualizer
      visualizer({
        ...nitro.options.analyze,
        filename: (nitro.options.analyze.filename || "stats.html").replace(
          "{name}",
          "nitro"
        ),
        title: "Nitro Server bundle stats",
      })
    );
  }

  return { config, base };
};
