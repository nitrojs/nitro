import type { Nitro } from "nitro/types";
import type { EnvironmentOptions } from "vite";
import type { getViteRollupConfig } from "./rollup";

import {
  createFetchableDevEnvironment,
  createNitroDevEnvironment,
} from "./dev";
import type { NitroViteService } from "./plugin";
import { NodeDevWorker } from "../../dev/worker";
import { join, resolve } from "node:path";
import { runtimeDir } from "nitro/runtime/meta";
import { resolveModulePath } from "exsolve";

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

export function createServiceEnvironment(
  name: string,
  serviceConfig: NitroViteService,
  nitro: Nitro
): EnvironmentOptions {
  return {
    consumer: "server",
    build: {
      rollupOptions: { input: serviceConfig.entry },
      outDir: join(nitro.options.buildDir, "vite", "services", name),
    },
    dev: {
      createEnvironment: (envName, envConfig) =>
        createFetchableDevEnvironment(
          envName,
          envConfig,
          new NodeDevWorker({
            name: name,
            entry: resolve(runtimeDir, "internal/vite/worker.mjs"),
            data: {
              name: name,
              server: true,
              viteEntry: resolveModulePath(serviceConfig.entry, {
                suffixes: ["", "/index"],
                extensions: ["", ".ts", ".mjs", ".cjs", ".js", ".mts", ".cts"],
              }),
              globals: {},
            },
            hooks: {},
          })
        ),
    },
  };
}

export function createServiceEnvironments(
  services: Record<string, NitroViteService> = {},
  nitro: Nitro
): Record<string, EnvironmentOptions> {
  return Object.fromEntries(
    Object.entries(services).map(([serviceName, serviceConfig]) => [
      serviceName,
      createServiceEnvironment(serviceName, serviceConfig, nitro),
    ])
  );
}
