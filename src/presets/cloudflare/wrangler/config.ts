import type { WranglerConfig } from "../types";

// prettier-ignore
const environmentInheritableKeys = new Set([
  "name", "account_id", "compatibility_date", "compatibility_flags", "main", "find_additional_modules", "preserve_file_names",
  "base_dir", "workers_dev", "preview_urls", "routes", "route", "tsconfig", "jsx_factory", "jsx_fragment", "migrations",
  "triggers", "usage_model", "limits", "rules", "build", "no_bundle", "minify", "node_compat", "first_party_worker",
  "zone_id", "logfwdr", "logpush", "upload_source_maps", "placement", "assets", "observability"
]);

/**
 * Resolves a raw wrangler configuration into an environment configuration.
 *
 * This function replicates in a simplified manner what wrangler does for resolving
 * the configuration resolution where inherited and non-inherited fields need to be
 * properly handled to form the final environment configuration to use.
 *
 * For more details on these fields see the Environment interface in ./types/environment.ts
 */
export function resolveEnvironmentConfig(
  rawConfig: WranglerConfig,
  environment: string | undefined
): Omit<WranglerConfig, "env"> {
  if (!environment) {
    // no environment was specified so we can simply return the full configuration without the potential env field
    const { env, ...config } = rawConfig;
    return config;
  }

  const environments = Object.keys(rawConfig.env ?? {});
  if (environments.length === 0) {
    throw new Error(
      `Requested the "${environment}" Cloudflare environment, but none were found in the configuration file`
    );
  }

  if (!environments.includes(environment)) {
    throw new Error(
      `Could not find the specified Cloudflare environment "${environment}", the environments defined in the configuration file are: ${environments.map((env) => JSON.stringify(env)).join(", ")}`
    );
  }

  const config: Record<string, unknown> = {};

  for (const key of Object.keys(rawConfig)) {
    if (environmentInheritableKeys.has(key)) {
      config[key] = rawConfig[key as keyof typeof rawConfig];
    }
  }

  const rawEnvironmentConfig = rawConfig!.env![environment];
  for (const key of Object.keys(rawEnvironmentConfig)) {
    config[key] =
      rawEnvironmentConfig[key as keyof typeof rawEnvironmentConfig];
  }

  return config as WranglerConfig;
}
