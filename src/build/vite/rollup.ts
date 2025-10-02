import type { Nitro, RollupConfig } from "nitro/types";
import { defu } from "defu";
import { sanitizeFilePath } from "mlly";
import { normalize, resolve, dirname } from "pathe";
import { runtimeDir } from "nitro/runtime/meta";
import alias from "@rollup/plugin-alias";
import inject from "@rollup/plugin-inject";
import { visualizer } from "rollup-plugin-visualizer";
import { replace } from "../plugins/replace";
import { baseBuildConfig, type BaseBuildConfig } from "../config";
import { baseBuildPlugins } from "../plugins";
import type { OutputBundle, Plugin as RollupPlugin } from "rollup";
import type { NitroPluginContext } from "./types";

/**
 * Removed from base rollup config:
 *  - nodeResolve
 *  - commonjs
 *  - esbuild
 *  - sourcemapMininify
 *  - json
 *
 * TODO: Reuse with rollup:
 * - chunkFileNames
 * - moduleSideEffects
 * - visualizer
 */

export const getViteRollupConfig = (
  ctx: NitroPluginContext
): { config: RollupConfig; base: BaseBuildConfig } => {
  const nitro = ctx.nitro!;
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
      ctx.pluginConfig.experimental?.virtualBundle &&
        virtualBundlePlugin(ctx._serviceBundles),
      ...baseBuildPlugins(nitro, base),
      alias({ entries: base.aliases }),
      replace({ preventAssignment: true, values: base.replacements }),
      inject(base.env.inject),
    ].filter(Boolean) as RollupPlugin[],
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

function virtualBundlePlugin(
  bundles: Record<string, OutputBundle>
): RollupPlugin {
  type VirtualModule = { code: string; map: string | null };
  let _modules: Map<string, VirtualModule> | null = null;

  // lazy initialize _modules since at the time of plugin creation, the bundles are not available yet
  const getModules = () => {
    if (_modules) {
      return _modules;
    }
    _modules = new Map();
    for (const bundle of Object.values(bundles)) {
      // group chunks and source maps
      for (const [fileName, content] of Object.entries(bundle)) {
        if (content.type === "chunk") {
          const virtualModule: VirtualModule = {
            code: content.code,
            map: null,
          };
          const maybeMap = bundle[`${fileName}.map`];
          if (maybeMap && maybeMap.type === "asset") {
            virtualModule.map = maybeMap.source as string;
          }
          _modules.set(fileName, virtualModule);
          _modules.set(resolve(fileName), virtualModule);
        }
      }
    }
    return _modules;
  };

  return {
    name: "virtual-bundle",
    resolveId(id, importer) {
      const modules = getModules();
      if (modules.has(id)) {
        return resolve(id);
      }

      if (importer) {
        const resolved = resolve(dirname(importer), id);
        if (modules.has(resolved)) {
          return resolved;
        }
      }
      return null;
    },
    load(id) {
      const modules = getModules();
      const m = modules.get(id);
      if (!m) {
        return null;
      }
      return m;
    },
  };
}
