import type { NitroRuntimeConfig } from "nitro/types";
import { applyEnv } from "./runtime-config.utils.ts";
import { runtimeConfig } from "#nitro-internal-virtual/runtime-config";

export function useRuntimeConfig(): NitroRuntimeConfig {
  return ((useRuntimeConfig as any)._cached ||= getRuntimeConfig());
}

function getRuntimeConfig() {
  const env = globalThis.process?.env || {};
  applyEnv(runtimeConfig, {
    prefix: "NITRO_",
    altPrefix: runtimeConfig.nitro?.envPrefix ?? env?.NITRO_ENV_PREFIX ?? "_",
    envExpansion: Boolean(
      runtimeConfig.nitro?.envExpansion ?? env?.NITRO_ENV_EXPANSION ?? false
    ),
  });
  return runtimeConfig;
}
