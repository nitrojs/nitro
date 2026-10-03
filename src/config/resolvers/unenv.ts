import consola from "consola";
import { resolveModulePath } from "exsolve";
import type { LegacyUnenvPreset, NitroOptions } from "nitro/types";

export async function resolveUnenv(options: NitroOptions) {
  options.inject ??= {};
  options.polyfills ??= [];
  options.external ??= [];
  applyLegacyUnenv(options);
}

/**
 * Merges presets of the deprecated `unenv` option into `alias`, `inject`,
 * `polyfills` and `external`, then empties it.
 *
 * Also called before each build, since modules and presets may still push
 * to `nitro.options.unenv` from hooks.
 */
export function applyLegacyUnenv(options: NitroOptions) {
  const presets = [options.unenv || []].flat().filter(Boolean) as LegacyUnenvPreset[];
  options.unenv = [];
  if (presets.length === 0) {
    return;
  }
  consola.warn(
    `"unenv" option is deprecated. Please use "alias", "inject", "polyfills" and "external" instead.`
  );

  const alias: Record<string, string> = {};
  const inject: NitroOptions["inject"] = {};
  const polyfills: string[] = [];
  const external: string[] = [];
  for (const preset of presets) {
    const resolve = (id: string) => resolvePresetId(id, preset.meta?.url);
    for (const [from, to] of Object.entries(preset.alias || {})) {
      alias[from] = resolve(to);
    }
    for (const [name, value] of Object.entries(preset.inject || {})) {
      inject[name] =
        value === false
          ? false
          : typeof value === "string"
            ? resolve(value)
            : [resolve(value[0]!), value[1]!];
    }
    polyfills.push(...(preset.polyfill || []).filter(Boolean).map((id) => resolve(id)));
    external.push(...(preset.external || []));
  }

  options.alias = { ...alias, ...options.alias };
  options.inject = { ...inject, ...options.inject };
  options.polyfills = [...polyfills, ...(options.polyfills || [])];
  options.external = [...external, ...(options.external || [])];
}

function resolvePresetId(id: string, url: string | URL | undefined): string {
  if (!url || id.startsWith("!")) {
    return id;
  }
  return resolveModulePath(id, { from: url, try: true }) || id;
}
