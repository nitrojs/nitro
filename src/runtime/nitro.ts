// Config
import type { NitroConfig } from "nitro/types";

export function defineConfig(
  config: Omit<NitroConfig, "rootDir">
): Omit<NitroConfig, "rootDir"> {
  return config;
}

// Type (only) helpers
export { defineNitroPlugin as definePlugin } from "./internal/plugin.ts";
export { defineRouteMeta } from "./internal/meta.ts";
