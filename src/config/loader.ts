import { loadConfig, watchConfig } from "c12";
import consola from "consola";
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
import { resolveImportsOptions } from "./resolvers/imports.ts";
import { resolveOpenAPIOptions } from "./resolvers/open-api.ts";
import { resolveTsconfig } from "./resolvers/tsconfig.ts";
import { resolvePathOptions } from "./resolvers/paths.ts";
import { resolveRouteRulesOptions } from "./resolvers/route-rules.ts";
import { resolveRuntimeConfigOptions } from "./resolvers/runtime-config.ts";
import { resolveStorageOptions } from "./resolvers/storage.ts";
import { resolveURLOptions } from "./resolvers/url.ts";
import { resolveErrorOptions } from "./resolvers/error.ts";
import { resolveUnenv } from "./resolvers/unenv.ts";
import { resolveBuilder } from "./resolvers/builder.ts";
import { resolveTracingOptions } from "./resolvers/tracing.ts";

const configResolvers = [
  resolveCompatibilityOptions,
  resolveTsconfig,
  resolvePathOptions,
  resolveImportsOptions,
  resolveRouteRulesOptions,
  resolveDatabaseOptions,
  resolveExportConditionsOptions,
  resolveRuntimeConfigOptions,
  resolveOpenAPIOptions,
  resolveURLOptions,
  resolveAssetsOptions,
  resolveStorageOptions,
  resolveErrorOptions,
  resolveUnenv,
  resolveBuilder,
  resolveTracingOptions,
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
  let preset: string | undefined = (configOverrides.preset as string) || process.env.NITRO_PRESET || process.env.SERVER_PRESET

  const _dotenv = opts.dotenv ?? (configOverrides.dev && { fileName: [".env", ".env.local"] });
  const loadedConfig = await (
    opts.watch
      ? watchConfig<NitroConfig & { _meta?: NitroPresetMeta }>
      : loadConfig<NitroConfig & { _meta?: NitroPresetMeta }>
  )({
    name: "nitro",
    cwd: configOverrides.rootDir,
    dotenv: _dotenv,
    extend: { extendKey: ["extends", "preset"] },
    defaults: NitroDefaults,
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
                compatibilityDate: compatibilityDate || "latest",
              })
                .then((p) => p?._meta?.name || "nitro-dev")
                .catch(() => "nitro-dev")
            : "nitro-dev";
      } else if (!preset) {
        // Auto detect production preset
        preset = await resolvePreset("" /* auto detect */, {
          static: getConf("static"),
          dev: false,
          compatibilityDate: compatibilityDate || "latest",
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
