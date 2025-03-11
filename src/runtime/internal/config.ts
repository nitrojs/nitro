import type { H3Event } from "h3";
import { klona } from "klona";
import type { NitroRuntimeConfig } from "nitro/types";
import { type EnvOptions, applyEnv } from "./utils.env";

// Static runtime config inlined by nitro build
const _inlineRuntimeConfig = process.env.RUNTIME_CONFIG as any;
const envOptions: EnvOptions = {
  prefix: "NITRO_",
  altPrefix:
    _inlineRuntimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_",
  envExpansion:
    _inlineRuntimeConfig.nitro.envExpansion ??
    process.env.NITRO_ENV_EXPANSION ??
    false,
};

// Runtime config
const _sharedRuntimeConfig = _deepFreeze(
  applyEnv(klona(_inlineRuntimeConfig), envOptions)
);
export function useRuntimeConfig<
  T extends NitroRuntimeConfig = NitroRuntimeConfig,
>(event?: H3Event): T {
  // Backwards compatibility with ambient context
  if (!event) {
    return _sharedRuntimeConfig as T;
  }
  // Reuse cached runtime config from event context
  if (event.context.nitro.runtimeConfig) {
    return event.context.nitro.runtimeConfig;
  }
  // Prepare runtime config for event context
  const runtimeConfig = klona(_inlineRuntimeConfig) as T;
  applyEnv(runtimeConfig, envOptions);
  event.context.nitro.runtimeConfig = runtimeConfig;
  return runtimeConfig;
}

// --- Utils ---

function _deepFreeze(object: Record<string, any>) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      _deepFreeze(value);
    }
  }
  return Object.freeze(object);
}

// --- Deprecated default export ---
// TODO: Remove in next major version
export default new Proxy(Object.create(null), {
  get: (_, prop) => {
    console.warn(
      "Please use `useRuntimeConfig()` instead of accessing config directly."
    );
    const runtimeConfig = useRuntimeConfig();
    if (prop in runtimeConfig) {
      return runtimeConfig[prop as string];
    }
    return undefined;
  },
});
