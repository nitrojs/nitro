// Config
import type { NitroConfig } from "nitro/types";

export function defineNitroConfig(
  config: Omit<NitroConfig, "rootDir">
): Omit<NitroConfig, "rootDir"> {
  return config;
}

export { defineNitroConfig as defineConfig };

// Type (only) helpers
export { defineNitroPlugin } from "./internal/plugin.ts";
export { defineRouteMeta } from "./internal/meta.ts";
export { defineNitroErrorHandler } from "./internal/error/utils.ts";
