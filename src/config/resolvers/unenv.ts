import consola from "consola";
import type { ConsolaInstance } from "../../types/_consola.ts";
import { resolveModulePath } from "exsolve";
import type { LegacyUnenvPreset, NitroOptions } from "nitro/types";
import type { PresetEnv } from "../../build/env.ts";

let warned = false;

export async function resolveUnenv(options: NitroOptions) {
  options.inject ??= {};
  options.polyfills ??= [];
  options.builtinModules ??= [];
  options.unenv = [options.unenv || []].flat().filter(Boolean);
  warnLegacyUnenv(options);
}

/**
 * Converts presets of the deprecated `unenv` option (including ones pushed to
 * `nitro.options.unenv` from hooks) to build env layers.
 *
 * They apply after preset layers and before user `alias`, `inject`,
 * `polyfills` and `builtinModules`.
 */
export function legacyUnenvLayers(
  options: NitroOptions,
  logger: ConsolaInstance = consola
): PresetEnv[] {
  warnLegacyUnenv(options, logger);
  return [options.unenv || []]
    .flat()
    .filter(Boolean)
    .map((preset) => {
      const resolve = (id: string) => resolvePresetId(id, preset.meta?.url);
      return {
        alias: Object.fromEntries(
          Object.entries(preset.alias || {}).map(([from, to]) => [from, resolve(to)])
        ),
        inject: Object.fromEntries(
          Object.entries(preset.inject || {}).map(([name, value]) => [
            name,
            value === false
              ? false
              : typeof value === "string"
                ? resolve(value)
                : [resolve(value[0]!), value[1]!],
          ])
        ),
        polyfills: (preset.polyfill || []).filter(Boolean).map((id) => resolve(id)),
        builtinModules: preset.external || [],
      };
    });
}

function warnLegacyUnenv(options: NitroOptions, logger: ConsolaInstance = consola) {
  if (warned || !(options.unenv as LegacyUnenvPreset[] | undefined)?.length) {
    return;
  }
  warned = true;
  logger.warn(
    `"unenv" option is deprecated. Please use "alias", "inject", "polyfills" and "builtinModules" instead.`
  );
}

function resolvePresetId(id: string, url: string | URL | undefined): string {
  if (!url || id.startsWith("!")) {
    return id;
  }
  return resolveModulePath(id, { from: url, try: true }) || id;
}
