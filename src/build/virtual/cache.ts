import type { Nitro, NitroCacheConfig, NitroCacheDefaults } from "nitro/types";

const functionDefaultKeys = ["maxAge", "swr", "staleMaxAge", "maxResolveTime", "base"] as const;

const handlerDefaultKeys = [
  ...functionDefaultKeys,
  "varies",
  "allowQuery",
  "allowCookies",
  "allowAuthorization",
  "sendCacheControl",
  "cacheStatusHeader",
  "maxBodySize",
] as const;

export default function cache(nitro: Nitro) {
  return {
    id: "#nitro/virtual/cache",
    template: () => {
      const config = nitro.options.cache || {};
      const defaults = config.defaults || {};
      return /* js */ `
${genStorage(config)}

export const cacheFunctionDefaults = ${genValue(pickDefined(defaults, functionDefaultKeys))};

export const cacheHandlerDefaults = ${genValue(pickDefined(defaults, handlerDefaultKeys))};
`;
    },
  };
}

function genStorage(config: NitroCacheConfig): string {
  switch (config.driver) {
    case "kv": {
      return /* js */ `export { createKVCacheStorage as createCacheStorage } from "#nitro/runtime/cache-kv";`;
    }
    case "fs": {
      return /* js */ `import { createFSCacheStorage } from "#nitro/runtime/cache-fs";
export const createCacheStorage = () => createFSCacheStorage(${genValue({ dir: config.fs?.dir })});`;
    }
    default: {
      return /* js */ `import { createMemoryStorage } from "ocache";
export const createCacheStorage = () => createMemoryStorage(${genValue(config.memory || {})});`;
    }
  }
}

function pickDefined(config: NitroCacheDefaults, keys: readonly (keyof NitroCacheDefaults)[]) {
  return Object.fromEntries(
    keys.filter((key) => config[key] !== undefined).map((key) => [key, config[key]])
  );
}

/** `JSON.stringify` that keeps `Infinity` (used by ocache to disable limits). */
function genValue(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v === Infinity ? "__INFINITY__" : v)).replaceAll(
    '"__INFINITY__"',
    "Infinity"
  );
}
