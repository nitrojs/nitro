import type { NitroOptions } from "nitro/types";

export type PresetEnv = Partial<Pick<NitroOptions, "alias" | "inject" | "polyfills" | "external">>;

/**
 * Adds `alias`, `inject`, `polyfills` and `external` entries from a hook.
 *
 * Existing `alias` and `inject` entries (user config) take precedence.
 */
export function extendEnv(options: NitroOptions, env: PresetEnv) {
  options.alias = { ...env.alias, ...options.alias };
  options.inject = { ...env.inject, ...options.inject };
  options.polyfills = [...(options.polyfills || []), ...(env.polyfills || [])];
  options.external = [...(options.external || []), ...(env.external || [])];
}
