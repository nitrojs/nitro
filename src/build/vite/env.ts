import type { Nitro } from "nitro/types";
import type { EnvironmentOptions } from "vite";
import type { getViteRollupConfig } from "./rollup";

import { createNitroDevEnvironment } from "./dev";

export function createNitroEnvironment(
  nitro: Nitro,
  rollupConfig: ReturnType<typeof getViteRollupConfig>
): EnvironmentOptions {
  return {
    consumer: "server",
    build: {
      rollupOptions: rollupConfig.config,
      minify: nitro.options.minify,
      commonjsOptions: {
        strictRequires: "auto", // TODO: set to true (default) in v3
        esmExternals: (id) => !id.startsWith("unenv/"),
        requireReturnsDefault: "auto",
        ...(nitro.options.commonJS as any),
      },
    },
    resolve: {
      noExternal: nitro.options.dev ? undefined : true,
      conditions: nitro.options.exportConditions,
      externalConditions: nitro.options.exportConditions,
      // https://github.com/vitejs/vite/pull/17583 (seems not effective)
      // alias: rollupOptions._base.aliases,
    },
    dev: {
      createEnvironment: (name, config) =>
        createNitroDevEnvironment(name, config, nitro),
    },
  };
}
