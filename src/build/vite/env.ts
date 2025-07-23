import type { EnvironmentOptions } from "vite";
import type { NitroPluginContext, ServiceConfig } from "./types";

import { join, resolve } from "pathe";
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
      createEnvironment: (envName, envConfig) => {
        const entry = resolve(runtimeDir, "internal/vite/nitro-dev.mjs");
        return createFetchableDevEnvironment(envName, envConfig, entry, ctx);
      },
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
      createEnvironment: (envName, envConfig) => {
        const entry = resolveModulePath(serviceConfig.entry, {
          suffixes: ["", "/index"],
          extensions: ["", ".ts", ".mjs", ".cjs", ".js", ".mts", ".cts"],
        });
        return createFetchableDevEnvironment(envName, envConfig, entry, ctx);
      },
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
