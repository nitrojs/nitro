import type { NitroConfig } from "nitro/types";

export function defineConfig(config: Omit<NitroConfig, "rootDir">): Omit<NitroConfig, "rootDir"> {
  return config;
}

/** @deprecated Use `defineConfig` from `nitro` instead. */
export const defineNitroConfig: typeof defineConfig = defineConfig;
