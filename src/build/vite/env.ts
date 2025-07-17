import type { EnvironmentOptions } from "vite";
import type { NitroPluginContext, ServiceConfig } from "./types";

import { NodeDevWorker } from "../../dev/worker";
import { join, resolve } from "node:path";
import { runtimeDependencies, runtimeDir } from "nitro/runtime/meta";
import { resolveModulePath } from "exsolve";
import { createFetchableDevEnvironment } from "./dev";

export function createNitroEnvironment(
  ctx: NitroPluginContext
): EnvironmentOptions {
  return {
    consumer: "server",
    build: {
      rollupOptions: ctx.rollupConfig!.config,
      minify: ctx.nitro!.options.minify,
      commonjsOptions: {
        strictRequires: "auto", // TODO: set to true (default) in v3
        esmExternals: (id) => !id.startsWith("unenv/"),
        requireReturnsDefault: "auto",
        ...(ctx.nitro!.options.commonJS as any),
      },
    },
    resolve: {
      noExternal: ctx.nitro!.options.dev
        ? // Workaround for dev: external dependencies are not resolvable with respect to nodeModulePaths
          new RegExp(runtimeDependencies.join("|"))
        : // Workaround for production: externals tracing currently does not work with Vite rollup build
          true,
      conditions: ctx.nitro!.options.exportConditions,
      externalConditions: ctx.nitro!.options.exportConditions,
    },
    dev: {
      createEnvironment: (envName, envConfig) =>
        createFetchableDevEnvironment(
          envName,
          envConfig,
          new NodeDevWorker({
            name: envName,
            entry: resolve(runtimeDir, "internal/vite/worker.mjs"),
            data: {
              name: envName,
              server: true,
              viteEntry: resolve(runtimeDir, "internal/vite/nitro-dev.mjs"),
              globals: {
                __NITRO_RUNTIME_CONFIG__: ctx.nitro!.options.runtimeConfig,
              },
            },
            hooks: {},
          })
        ),
    },
  };
}

export function createServiceEnvironment(
  ctx: NitroPluginContext,
  name: string,
  serviceConfig: ServiceConfig
): EnvironmentOptions {
  return {
    consumer: "server",
    build: {
      rollupOptions: { input: serviceConfig.entry },
      minify: ctx.nitro!.options.minify,
      outDir: join(ctx.nitro!.options.buildDir, "vite", "services", name),
      emptyOutDir: true,
    },
    resolve: {
      noExternal: ctx.nitro!.options.dev ? undefined : true,
      conditions: ctx.nitro!.options.exportConditions,
      externalConditions: ctx.nitro!.options.exportConditions,
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
  ctx: NitroPluginContext
): Record<string, EnvironmentOptions> {
  return Object.fromEntries(
    Object.entries(ctx.pluginConfig.services || {}).map(([name, config]) => [
      name,
      createServiceEnvironment(ctx, name, config),
    ])
  );
}
