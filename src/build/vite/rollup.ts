import type { RollupConfig } from "nitro/types";
import { defu } from "defu";
import { resolve, dirname } from "pathe";
import alias from "@rollup/plugin-alias";
import inject from "@rollup/plugin-inject";
import { baseBuildConfig, type BaseBuildConfig } from "../config.ts";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";
import { baseBuildPlugins } from "../plugins.ts";
import type { OutputBundle, Plugin as RollupPlugin } from "rollup";
import type { NitroPluginContext } from "./types.ts";

export const getViteRollupConfig = (
  ctx: NitroPluginContext
): { config: RollupConfig; base: BaseBuildConfig } => {
  const nitro = ctx.nitro!;
  const base = baseBuildConfig(nitro);

  let config = {
    input: nitro.options.entry,
    external: [...base.env.external],
    plugins: [
      ctx.pluginConfig.experimental?.vite?.virtualBundle &&
        virtualBundlePlugin(ctx._serviceBundles),
      ...baseBuildPlugins(nitro, base),
      alias({ entries: base.aliases }),
      !ctx._isRolldown &&
        (inject as unknown as typeof inject.default)(base.env.inject),
    ].filter(Boolean) as RollupPlugin[],
    // rolldown-specific config
    ...(ctx._isRolldown
      ? {
          transform: {
            inject: base.env.inject as Record<string, string>,
          },
        }
      : {}),
    treeshake: {
      moduleSideEffects(id) {
        return nitro.options.moduleSideEffects.some((p) => id.startsWith(p));
      },
    },
    output: {
      format: "esm",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk) => getChunkName(chunk, nitro),
      ...(ctx._isRolldown
        ? {
            advancedChunks: {
              groups: [
                {
                  test: NODE_MODULES_RE,
                  name: (id: string) => libChunkName(id),
                },
              ],
            },
          }
        : {
            manualChunks(id: string) {
              if (NODE_MODULES_RE.test(id)) {
                return libChunkName(id);
              }
            },
          }),
      inlineDynamicImports: nitro.options.inlineDynamicImports,
      dir: nitro.options.output.serverDir,
      generatedCode: {
        // constBindings is not supported in rolldown
        ...(ctx._isRolldown ? {} : { constBindings: true }),
      },
      // sanitizeFileName: sanitizeFilePath,
      // sourcemapExcludeSources is not supported in rolldown
      ...(ctx._isRolldown ? {} : { sourcemapExcludeSources: true }),
      sourcemapIgnoreList: (id) => id.includes("node_modules"),
    },
  } satisfies RollupConfig;

  config = defu(nitro.options.rollupConfig as any, config);

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
