import { NitroConfig } from "nitro/types";

export { NitroConfig } from "nitro/types";

declare function defineNitroConfig(
  config: Omit<NitroConfig, "rootDir">
): Omit<NitroConfig, "rootDir">;

export { defineNitroConfig };
