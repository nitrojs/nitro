import type { NitroConfig, NitroOptions, NitroRouteRules } from "nitro/types";
import { normalizeRouteRules as _normalizeRouteRules } from "h3-rules";

export async function resolveRouteRulesOptions(options: NitroOptions) {
  options.routeRules = normalizeRouteRules(options);
}

// Normalization (shortcut expansion, `redirect`/`proxy` string forms, the `/**`
// scope `base` field) is owned by `h3-rules`. Nitro keeps this thin wrapper so
// callers can pass a config object and get back the `path -> rules` map.
export function normalizeRouteRules(config: NitroConfig): Record<string, NitroRouteRules> {
  return _normalizeRouteRules(config.routeRules || {});
}
