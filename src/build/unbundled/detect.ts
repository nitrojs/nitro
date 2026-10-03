import type { NitroConfig } from "nitro/types";

import { loadConfig } from "c12";

/**
 * Whether the project runs without a builder in production (`builder: false`).
 *
 * Reads the user config (with layers and `$production`) and `NITRO_BUILDER` only: resolving
 * the options can install dependencies (e.g. the builder).
 */
export async function isUnbundledProject(rootDir: string): Promise<boolean> {
  const { config } = await loadConfig<NitroConfig>({
    name: "nitro",
    cwd: rootDir,
    dotenv: false,
    envName: "production",
    extend: { extendKey: ["extends"] },
  });
  const builder: unknown = config.builder ?? process.env.NITRO_BUILDER;
  return builder === false || builder === "false";
}
