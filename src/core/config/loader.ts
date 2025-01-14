import { loadConfig, watchConfig } from "c12";
import { type CompatibilityDateSpec, resolveCompatibilityDates } from "compatx";
import { klona } from "klona/full";
import type { PresetName } from "nitropack/presets";
import type {
  LoadConfigOptions,
  NitroConfig,
  NitroOptions,
  NitroPresetMeta,
} from "nitropack/types";

import { NitroDefaults } from "./defaults";

// Resolvers
import { resolveAssetsOptions } from "./resolvers/assets";
import {
  fallbackCompatibilityDate,
  resolveCompatibilityOptions,
} from "./resolvers/compatibility";
import { resolveDatabaseOptions } from "./resolvers/database";
import { resolveExportConditionsOptions } from "./resolvers/export-conditions";
import { resolveFetchOptions } from "./resolvers/fetch";
import { resolveImportsOptions } from "./resolvers/imports";
import { resolveOpenAPIOptions } from "./resolvers/open-api";
import { resolvePathOptions } from "./resolvers/paths";
import { resolveRouteRulesOptions } from "./resolvers/route-rules";
import { resolveRuntimeConfigOptions } from "./resolvers/runtime-config";
import { resolveStorageOptions } from "./resolvers/storage";
import { resolveURLOptions } from "./resolvers/url";
import { resolveErrorOptions } from "./resolvers/error";

const configResolvers = [
  resolveCompatibilityOptions,
  resolvePathOptions,
  resolveImportsOptions,
  resolveRouteRulesOptions,
  resolveDatabaseOptions,
  resolveFetchOptions,
  resolveExportConditionsOptions,
  resolveRuntimeConfigOptions,
  resolveOpenAPIOptions,
  resolveURLOptions,
  resolveAssetsOptions,
  resolveStorageOptions,
  resolveErrorOptions,
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
  // Preset
  let presetOverride =
    (configOverrides.preset as string) ||
    process.env.NITRO_PRESET ||
    process.env.SERVER_PRESET;
  if (configOverrides.dev) {
    presetOverride = "nitro-dev";
  }

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
  const { resolvePreset } = (await import(
    "nitropack/" + "presets"
  )) as typeof import("nitropack/presets");

  const loadedConfig = await (
    opts.watch
      ? watchConfig<NitroConfig & { _meta?: NitroPresetMeta }>
      : loadConfig<NitroConfig & { _meta?: NitroPresetMeta }>
  )({
    name: "nitro",
    cwd: configOverrides.rootDir,
    dotenv: configOverrides.dev,
    extend: { extendKey: ["extends", "preset"] },
    overrides: {
      ...configOverrides,
      preset: presetOverride,
    },
    async defaultConfig({ configs }) {
      const getConf = <K extends keyof NitroConfig>(key: K) =>
        (configs.main?.[key] ??
          configs.rc?.[key] ??
          configs.packageJson?.[key]) as NitroConfig[K];

      if (!compatibilityDate) {
        compatibilityDate = getConf("compatibilityDate");
      }
      const framework = configs.overrides?.framework || configs.main?.framework;
      return {
        typescript: {
          generateRuntimeConfigTypes:
            !framework?.name || framework.name === "nitro",
        },
        preset:
          presetOverride ||
          (
            await resolvePreset("" /* auto detect */, {
              static: getConf("static"),
              compatibilityDate: compatibilityDate || fallbackCompatibilityDate,
            })
          )?._meta?.name,
      };
    },
    defaults: NitroDefaults,
    jitiOptions: {
      alias: {
        nitropack: "nitropack/config",
        "nitropack/config": "nitropack/config",
      },
    },
    async resolve(id: string) {
      const preset = await resolvePreset(id, {
        static: configOverrides.static,
        compatibilityDate: compatibilityDate || fallbackCompatibilityDate,
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
    (loadedConfig.layers || []).find((l) => l.config?._meta?.name)?.config
      ?._meta?.name || presetOverride;
  options.preset = _presetName as PresetName;

  options.compatibilityDate = resolveCompatibilityDates(
    compatibilityDate,
    options.compatibilityDate
  );

  return options;
}
