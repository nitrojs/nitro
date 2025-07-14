import destr from "destr";
import { snakeCase } from "scule";

export type EnvOptions = {
  prefix?: string;
  altPrefix?: string;
  envExpansion?: boolean;
};

export function getEnv(key: string, opts: EnvOptions) {
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}

function _isObject(input: unknown) {
  return typeof input === "object" && !Array.isArray(input);
}

export function applyEnv(
  obj: Record<string, any>,
  opts: EnvOptions,
  parentKey = ""
) {
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
