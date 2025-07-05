import type { Nitro } from "nitro/types";
import type { EnvironmentOptions } from "vite";
import type { getViteRollupConfig } from "./rollup";

import {
  createFetchableDevEnvironment,
  createNitroDevEnvironment,
} from "./dev";
import type { NitroViteService } from "./plugin";
import { NodeDevWorker } from "../../dev/worker";

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

export function createServiceEnvironments(
  services: Record<string, NitroViteService> = {}
): Record<string, EnvironmentOptions> {
  return Object.fromEntries(
    Object.entries(services).map(([name, config]) => {
      const env: EnvironmentOptions = {
        consumer: "server",
        build: {
          rollupOptions: { input: config.entry },
        },
        dev: {
          createEnvironment: (name, config) =>
            createFetchableDevEnvironment(
              name,
              config,
              new NodeDevWorker({
                name,
                entry: "",
                hooks: {},
              })
            ),
        },
      };
      return [name, env];
    })
  );
}
