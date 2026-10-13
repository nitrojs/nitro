import { loadConfig, watchConfig } from "c12";
import consola from "consola";
import { createDefu, defu } from "defu";
import { resolveCompatibilityDates } from "compatx";
import type { CompatibilityDateSpec } from "compatx";
import { klona } from "klona/full";
import type { PresetName } from "../presets/index.ts";
import type { LoadConfigOptions, NitroConfig, NitroOptions, NitroPresetMeta } from "nitro/types";

import { NitroDefaults } from "./defaults.ts";

// Resolvers
import { resolveAssetsOptions } from "./resolvers/assets.ts";
import { resolveCompatibilityOptions } from "./resolvers/compatibility.ts";
import { resolveDatabaseOptions } from "./resolvers/database.ts";
import { resolveExportConditionsOptions } from "./resolvers/export-conditions.ts";
import { resolveOpenAPIOptions } from "./resolvers/open-api.ts";
import { resolveTsconfig } from "./resolvers/tsconfig.ts";
import { resolvePathOptions } from "./resolvers/paths.ts";
import { resolveRouteRulesOptions } from "./resolvers/route-rules.ts";
import { resolveRuntimeConfigOptions } from "./resolvers/runtime-config.ts";
import { resolveKVOptions } from "./resolvers/kv.ts";
import { resolveCacheOptions } from "./resolvers/cache.ts";
import { resolveURLOptions } from "./resolvers/url.ts";
import { resolveErrorOptions } from "./resolvers/error.ts";
import { resolveUnenv } from "./resolvers/unenv.ts";
import { resolveBuilder } from "./resolvers/builder.ts";
import { resolveTracingChannelOptions } from "./resolvers/tracing.ts";

const configResolvers = [
  resolveCompatibilityOptions,
  resolveTsconfig,
  resolvePathOptions,
  resolveRouteRulesOptions,
  resolveDatabaseOptions,
  resolveExportConditionsOptions,
  resolveRuntimeConfigOptions,
  resolveOpenAPIOptions,
  resolveURLOptions,
  resolveAssetsOptions,
  resolveKVOptions,
  resolveCacheOptions,
  resolveErrorOptions,
  resolveUnenv,
  resolveBuilder,
  resolveTracingChannelOptions,
] as const;

export async function loadOptions(
  configOverrides: NitroConfig = {},
  opts: LoadConfigOptions = {}
): Promise<NitroOptions> {
  const options = await _loadUserConfig(configOverrides, opts);
  for (const resolver of configResolvers) {
    await resolver(options);
  }
  return options;
}

async function _loadUserConfig(
  configOverrides: NitroConfig = {},
  opts: LoadConfigOptions = {}
): Promise<NitroOptions> {
  // Load configuration and preset
  configOverrides = klona(configOverrides);

  // @ts-ignore
  globalThis.defineNitroConfig = globalThis.defineNitroConfig || ((c) => c);

  // Compatibility date
  let compatibilityDate: CompatibilityDateSpec | undefined =
    configOverrides.compatibilityDate ||
    opts.compatibilityDate ||
    ((process.env.NITRO_COMPATIBILITY_DATE ||
      process.env.SERVER_COMPATIBILITY_DATE ||
      process.env.COMPATIBILITY_DATE) as CompatibilityDateSpec);

  // Preset resolver
  const { resolvePreset } = await import("../presets/index.ts");

  // prettier-ignore
  let preset: string | undefined = (configOverrides.preset as string) || process.env.NITRO_PRESET || process.env.SERVER_PRESET;

  // Inline `defaultPreset` object resolved during auto-detection (injected via `resolve`)
  let inlineDefaultPreset: (NitroConfig & { _meta?: NitroPresetMeta }) | undefined;

  // Inline `extends` objects keyed by a placeholder id (injected via `resolve`)
  // c12 only extends from string sources, so objects are swapped for an id here
  const inlineExtends = new Map<string, NitroConfig>();

  const _dotenv = opts.dotenv ?? { fileName: [".env", ".env.local"] };
  const envName =
    opts.c12?.envName ??
    (configOverrides.dev
      ? "development"
      : configOverrides.preset === "nitro-prerender"
        ? ["production", "prerender"]
        : "production");
  const loadedConfig = await (
    opts.watch
      ? watchConfig<NitroConfig & { _meta?: NitroPresetMeta }>
      : loadConfig<NitroConfig & { _meta?: NitroPresetMeta }>
  )({
    name: "nitro",
    cwd: configOverrides.rootDir,
    dotenv: _dotenv,
    envName,
    extend: { extendKey: ["extends", "preset"] },
    defaults: NitroDefaults,
    envMerger: mergeEnvConfig,
    async overrides({ rawConfigs }) {
      // prettier-ignore
      const getConf = <K extends keyof NitroConfig>(key: K) => (configOverrides[key] ?? (rawConfigs.main as NitroConfig)?.[key] ?? (rawConfigs.rc as NitroConfig)?.[key] ?? (rawConfigs.packageJson as NitroConfig)?.[key]) as NitroConfig[K];

      if (!compatibilityDate) {
        compatibilityDate = getConf("compatibilityDate");
      }

      if (!preset) {
        preset = getConf("preset");
      }

      if (configOverrides.dev) {
        // Check if preset has compatible dev support
        // Otherwise use default nitro-dev preset
        preset =
          preset && preset !== "nitro-dev"
            ? await resolvePreset(preset, {
                static: getConf("static"),
                dev: true,
                compatibilityDate: compatibilityDate || "latest",
              })
                .then((p) => p?._meta?.name || "nitro-dev")
                .catch(() => "nitro-dev")
            : "nitro-dev";
      } else if (!preset) {
        // Auto detect production preset (with user-defined `defaultPreset` fallback)
        const defaultPreset = getConf("defaultPreset");
        const resolved = await resolvePreset("" /* auto detect */, {
          static: getConf("static"),
          dev: false,
          compatibilityDate: compatibilityDate || "latest",
          defaultPreset,
        });
        preset = resolved?._meta?.name;
        // An inline `defaultPreset` object has no resolvable name, inject it directly
        if (resolved && defaultPreset && typeof defaultPreset !== "string") {
          inlineDefaultPreset = resolved;
        }
      }

      // Merge `extends` in the same order c12 merges the configs, then swap inline objects for ids
      // Without inline objects, c12 resolves `extends` as usual
      inlineExtends.clear();
      const extendsLayers = [
        configOverrides,
        rawConfigs.main,
        rawConfigs.rc,
        rawConfigs.packageJson,
      ] as (NitroConfig | null | undefined)[];
      const merger = opts.c12?.merger || defu;
      const { extends: mergedExtends } = merger(
        {},
        ...extendsLayers.map((layer) => ({ extends: layer?.extends }))
      );
      const extendsSources = normalizeExtends(mergedExtends, inlineExtends);
      if (inlineExtends.size === 0) {
        return { ...configOverrides, preset };
      }
      // The original `extends` are removed so c12 does not merge the objects back in
      for (const layer of extendsLayers.slice(1)) {
        if (layer) {
          delete layer.extends;
        }
      }

      return {
        ...configOverrides,
        preset,
        extends: extendsSources as NitroConfig["extends"],
      };
    },
    async resolve(id: string) {
      if (inlineDefaultPreset && id === inlineDefaultPreset._meta?.name) {
        return { config: klona(inlineDefaultPreset) };
      }
      const inlineConfig = inlineExtends.get(id);
      if (inlineConfig) {
        return { config: klona(inlineConfig), cwd: configOverrides.rootDir };
      }
      const preset = await resolvePreset(id, {
        static: configOverrides.static,
        compatibilityDate: compatibilityDate || "latest",
        dev: configOverrides.dev,
      });
      if (preset) {
        return {
          config: klona(preset),
        };
      }
    },
    ...opts.c12,
  });

  const options = klona(loadedConfig.config) as NitroOptions;

  options._config = configOverrides;
  options._c12 = loadedConfig;

  const _presetName =
    (loadedConfig.layers || []).find((l) => l.config?._meta?.name)?.config?._meta?.name || preset;
  options.preset = _presetName as PresetName;

  options.compatibilityDate = resolveCompatibilityDates(
    compatibilityDate,
    options.compatibilityDate
  );

  if (options.dev && options.preset !== "nitro-dev") {
    consola.info(`Using \`${options.preset}\` emulation in development mode.`);
  }

  return options;
}

const kvConfigKeys = new Set(["kv", "storage", "devStorage"]);

// Env mounts (e.g. from `$development`) with a different driver replace the whole mount instead of deep merging options
const mergeEnvConfig = createDefu((obj, key, value, namespace) => {
  const current = obj[key] as { driver?: unknown } | undefined;
  if (
    kvConfigKeys.has(namespace) &&
    value?.driver &&
    current?.driver &&
    value.driver !== current.driver
  ) {
    obj[key] = value;
    return true;
  }
}) as (...sources: any[]) => any;

/**
 * Flatten an `extends` source into an array of sources c12 can resolve.
 * Inline objects are stored in `inline` under a placeholder id and replaced with that id.
 * Sources c12 already handles (strings, `[source, options]` and `{ source, options }`) are kept as is.
 */
function normalizeExtends(
  source: NitroConfig["extends"] | undefined,
  inline: Map<string, NitroConfig>
): unknown[] {
  const result: unknown[] = [];
  for (const entry of (Array.isArray(source) ? source : [source]) as unknown[]) {
    if (!entry) {
      continue;
    }
    if (
      typeof entry === "string" ||
      Array.isArray(entry) ||
      (entry as { source?: unknown }).source
    ) {
      result.push(entry);
      continue;
    }
    const id = `#inline-extends-${inline.size}`;
    const config = {
      ...(typeof entry === "function" ? (entry as () => NitroConfig)() : (entry as NitroConfig)),
    };
    // Register before recursing so nested objects get their own ids
    inline.set(id, config);
    // Nested inline objects are normalized too, so c12 can extend them recursively
    if (config.extends) {
      config.extends = normalizeExtends(config.extends, inline) as NitroConfig["extends"];
    }
    result.push(id);
  }
  return result;
}
