import type { NitroRuntimeConfig } from "nitro/types";
import { snakeCase } from "scule";
import { runtimeConfig } from "#nitro/virtual/runtime-config";

export function useRuntimeConfig(): NitroRuntimeConfig {
  return ((useRuntimeConfig as any)._cached ||= getRuntimeConfig());
}

function getRuntimeConfig() {
  const env = globalThis.process?.env || {};
  applyEnv(runtimeConfig, {
    prefix: "NITRO_",
    altPrefix: runtimeConfig.nitro?.envPrefix ?? env?.NITRO_ENV_PREFIX ?? "_",
    envExpansion: Boolean(runtimeConfig.nitro?.envExpansion ?? env?.NITRO_ENV_EXPANSION ?? false),
  });
  return runtimeConfig;
}

// ---- utils ----

type EnvOptions = {
  prefix?: string;
  altPrefix?: string;
  envExpansion?: boolean;
};

export function applyEnv(obj: Record<string, any>, opts: EnvOptions, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      // Same as before
      if (_isObject(envValue)) {
        obj[key] = { ...(obj[key] as any), ...(envValue as any) };
        applyEnv(obj[key], opts, subKey);
      }
      // If envValue is undefined
      // Then proceed to nested properties
      else if (envValue === undefined) {
        applyEnv(obj[key], opts, subKey);
      }
      // If envValue is a primitive other than undefined
      // Then set objValue and ignore the nested properties
      else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
    // Experimental env expansion
    if (opts.envExpansion && typeof obj[key] === "string") {
      obj[key] = _expandFromEnv(obj[key]);
    }
  }
  return obj;
}

const envExpandRx = /\{\{([^{}]*)\}\}/g;

function _expandFromEnv(value: string) {
  return value.replace(envExpandRx, (match, key) => {
    return process.env[key] || match;
  });
}

function getEnv(key: string, opts: EnvOptions) {
  const envKey = snakeCase(key).toUpperCase();
  return process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey];
}

function _isObject(input: unknown) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
