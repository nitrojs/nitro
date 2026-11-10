import type { BunConfig, Nitro } from "nitro/types";
import type { Plugin } from "rollup";

type RollupLikeConfig = {
  plugins?: unknown;
  external?: unknown;
  platform?: string;
  output?: {
    entryFileNames?: unknown;
    chunkFileNames?: unknown;
    format?: string;
    inlineDynamicImports?: boolean;
    banner?: unknown;
    footer?: unknown;
  };
};

/**
 * Options of `rollupConfig` and `rolldownConfig` (which takes precedence) supported by the `bun`
 * builder. Presets set them for every builder (e.g. plugins or the entry file name).
 */
export async function fromRollupConfig(
  nitro: Nitro
): Promise<{ config: BunConfig; plugins: Plugin[] }> {
  const configs = [nitro.options.rolldownConfig, nitro.options.rollupConfig] as (
    | RollupLikeConfig
    | undefined
  )[];
  const output = (key: keyof NonNullable<RollupLikeConfig["output"]>) =>
    configs.map((config) => config?.output?.[key]).find((value) => value !== undefined);

  const format = output("format") as string | undefined;
  const inlineDynamicImports = output("inlineDynamicImports") ?? nitro.options.inlineDynamicImports;
  const entryFileNames = output("entryFileNames");
  const chunkFileNames = output("chunkFileNames");

  const config: BunConfig = {
    format: format === "iife" ? "iife" : format === "cjs" || format === "commonjs" ? "cjs" : "esm",
    splitting: !inlineDynamicImports && format !== "iife",
  };
  // e.g. Cloudflare with Node.js compatibility (Bun has no `neutral` target)
  if (nitro.options.rolldownConfig?.platform === "node") {
    config.target = "node";
  }
  if (typeof entryFileNames === "string" || typeof chunkFileNames === "string") {
    config.naming = {
      entry: typeof entryFileNames === "string" ? entryFileNames : undefined,
      chunk: typeof chunkFileNames === "string" ? chunkFileNames : undefined,
    };
  }
  for (const key of ["banner", "footer"] as const) {
    const value = output(key);
    if (typeof value === "string") {
      config[key] = value;
    }
  }

  const plugins = await Promise.all(configs.map((config) => flatPlugins(config?.plugins)));
  // Same as `defu` with the other builders: arrays are concatenated, `rolldownConfig` wins otherwise
  const [rolldownExternal, rollupExternal] = configs.map((config) => config?.external);
  const external = externalPlugin(
    Array.isArray(rolldownExternal) && Array.isArray(rollupExternal)
      ? [...rolldownExternal, ...rollupExternal]
      : (rolldownExternal ?? rollupExternal)
  );

  return { config, plugins: [...(external ? [external] : []), ...plugins.flat()] };
}

async function flatPlugins(plugins: unknown): Promise<Plugin[]> {
  plugins = await plugins;
  if (Array.isArray(plugins)) {
    return (await Promise.all(plugins.map((plugin) => flatPlugins(plugin)))).flat();
  }
  return plugins && typeof plugins === "object" ? [plugins as Plugin] : [];
}

/** Rollup's `external` option as a plugin (Bun only supports a list of strings). */
function externalPlugin(external: unknown): Plugin | undefined {
  if (!external) {
    return;
  }
  const isExternal =
    typeof external === "function"
      ? (id: string, importer: string | undefined) => !!external(id, importer, false)
      : (id: string) =>
          [external].flat().some((pattern) => {
            if (pattern instanceof RegExp) {
              pattern.lastIndex = 0;
              return pattern.test(id);
            }
            return pattern === id;
          });
  return {
    name: "nitro:external",
    resolveId: {
      order: "pre",
      handler: (id, importer) => (isExternal(id, importer) ? { id, external: true } : undefined),
    },
  };
}
