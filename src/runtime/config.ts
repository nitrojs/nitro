import type { NitroConfig } from "nitro/types";

export function defineConfig(config: Omit<NitroConfig, "rootDir">): Omit<NitroConfig, "rootDir"> {
  return config;
}

export { defineConfig as defineNitroConfig };
