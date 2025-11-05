import { defu } from "defu";
import { snakeCase } from "scule";

import type {
  NitroConfig,
  NitroOptions,
  NitroRuntimeConfig,
} from "nitro/types";

export async function resolveRuntimeConfigOptions(options: NitroOptions) {
  options.runtimeConfig = normalizeRuntimeConfig(options);

  const envOpts = {
    prefix: "NITRO_",
    altPrefix:
      options.runtimeConfig.nitro?.envPrefix ??
      process.env?.NITRO_ENV_PREFIX ??
      "_",
  };

  // Apply environment variables to runtime config at build time
  applyEnvToConfig(options.runtimeConfig, envOpts);
}

export function normalizeRuntimeConfig(config: NitroConfig) {
  provideFallbackValues(config.runtimeConfig || {});
  const runtimeConfig: NitroRuntimeConfig = defu(
    config.runtimeConfig as NitroRuntimeConfig,
    {
      app: {
        baseURL: config.baseURL,
      },
      nitro: {
        envExpansion: config.experimental?.envExpansion,
        openAPI: config.openAPI,
      },
    } as NitroRuntimeConfig
  );
  runtimeConfig.nitro.routeRules = config.routeRules;
  checkSerializableRuntimeConfig(runtimeConfig);
  return runtimeConfig as NitroRuntimeConfig;
}

function provideFallbackValues(obj: Record<string, any>) {
  for (const key in obj) {
    if (obj[key] === undefined || obj[key] === null) {
      obj[key] = "";
    } else if (typeof obj[key] === "object") {
      provideFallbackValues(obj[key]);
    }
  }
}

function checkSerializableRuntimeConfig(obj: any, path: string[] = []) {
  if (isPrimitiveValue(obj)) {
    return;
  }

  for (const key in obj) {
    const value = obj[key];
    if (value === null || value === undefined || isPrimitiveValue(value)) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries())
        checkSerializableRuntimeConfig(item, [...path, `${key}[${index}]`]);
    } else if (
      typeof value === "object" &&
      value.constructor === Object &&
      (!value.constructor?.name || value.constructor.name === "Object")
    ) {
      checkSerializableRuntimeConfig(value, [...path, key]);
    } else {
      console.warn(
        `Runtime config option \`${[...path, key].join(".")}\` may not be able to be serialized.`
      );
    }
  }
}

function isPrimitiveValue(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

type EnvOptions = {
  prefix?: string;
  altPrefix?: string;
};

function getEnv(key: string, opts: EnvOptions) {
  const envKey = snakeCase(key).toUpperCase();
  return (
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}

function _isObject(input: unknown) {
  return typeof input === "object" && !Array.isArray(input);
}

function applyEnvToConfig(
  obj: Record<string, any>,
  opts: EnvOptions,
  parentKey = ""
) {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      // If envValue is an object, merge it
      if (_isObject(envValue)) {
        obj[key] = { ...(obj[key] as any), ...(envValue as any) };
        applyEnvToConfig(obj[key], opts, subKey);
      }
      // If envValue is undefined, recurse into nested properties
      else if (envValue === undefined) {
        applyEnvToConfig(obj[key], opts, subKey);
      }
      // If envValue is a primitive, set it and skip nested properties
      else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
  }
  return obj;
}
