import type { NitroConfig, NitroOptions, NitroRouteRules } from "nitro/types";
import { normalizeRouteRules as _normalizeRouteRules } from "h3/rules";

export async function resolveRouteRulesOptions(options: NitroOptions) {
  options.routeRules = normalizeRouteRules(options);
}

// Normalization (shortcut expansion, `redirect`/`proxy` string forms, the `/**`
// scope `base` field) is owned by `h3/rules`. Nitro keeps this thin wrapper so
// callers can pass a config object and get back the `path -> rules` map.
export function normalizeRouteRules(config: NitroConfig): Record<string, NitroRouteRules> {
  const routeRules = config.routeRules || {};
  for (const route in routeRules) {
    // Authentication needs executable logic, so it is middleware, not a rule.
    if (routeRules[route] && "basicAuth" in routeRules[route]) {
      throw new Error(
        `[nitro] \`basicAuth\` is not a route rule (\`${route}\`). Register h3's \`basicAuth\` middleware instead: globally from \`middleware/\`, or per route with \`defineHandler({ middleware: [basicAuth({ ... })], handler })\`.`
      );
    }
  }
  return _normalizeRouteRules(routeRules);
}
