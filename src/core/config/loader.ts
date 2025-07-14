import { loadConfig, watchConfig } from "c12";
import consola from "consola";
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
import { resolveUnenv } from "./resolvers/unenv";

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
  resolveUnenv,
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
  const { resolvePreset } = (await import(
    "nitropack/" + "presets"
  )) as typeof import("nitropack/presets");

  // prettier-ignore
  let preset: string | undefined = (configOverrides.preset as string) || process.env.NITRO_PRESET || process.env.SERVER_PRESET

  const loadedConfig = await (
    opts.watch
      ? watchConfig<NitroConfig & { _meta?: NitroPresetMeta }>
      : loadConfig<NitroConfig & { _meta?: NitroPresetMeta }>
  )({
    name: "nitro",
    cwd: configOverrides.rootDir,
    dotenv: opts.dotenv ?? configOverrides.dev,
    extend: { extendKey: ["extends", "preset"] },
    defaults: NitroDefaults,
    jitiOptions: {
      alias: {
        nitropack: "nitropack/config",
        "nitropack/config": "nitropack/config",
      },
    },
    async overrides({ rawConfigs }) {
      // prettier-ignore
      const getConf = <K extends keyof NitroConfig>(key: K) => (configOverrides[key] ?? (rawConfigs.main as NitroConfig)?.[key] ?? (rawConfigs.rc as NitroConfig)?.[key] ?? (rawConfigs.packageJson as NitroConfig)?.[key]) as NitroConfig[K];

      if (!compatibilityDate) {
        compatibilityDate = getConf("compatibilityDate");
      }

      // prettier-ignore
      const framework = getConf("framework")
      const isCustomFramework = framework?.name && framework.name !== "nitro";

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
                compatibilityDate:
                  compatibilityDate || fallbackCompatibilityDate,
              })
                .then((p) => p?._meta?.name)
                .catch(() => "nitro-dev")
            : "nitro-dev";
      } else if (!preset) {
        // Auto detect production preset
        preset = await resolvePreset("" /* auto detect */, {
          static: getConf("static"),
          dev: false,
          compatibilityDate: compatibilityDate || fallbackCompatibilityDate,
        }).then((p) => p?._meta?.name);
      }

      return {
        ...configOverrides,
        preset,
        typescript: {
          generateRuntimeConfigTypes: !isCustomFramework,
          ...getConf("typescript"),
          ...configOverrides.typescript,
        },
      };
    },
    async resolve(id: string) {
      const preset = await resolvePreset(id, {
        static: configOverrides.static,
        compatibilityDate: compatibilityDate || fallbackCompatibilityDate,
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
    (loadedConfig.layers || []).find((l) => l.config?._meta?.name)?.config
      ?._meta?.name || preset;
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
