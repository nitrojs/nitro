import type { EnvironmentOptions, RollupCommonJSOptions } from "vite";
import type { NitroPluginContext, ServiceConfig } from "./types.ts";

import { NodeEnvRunner } from "../../runner/node.ts";
import { join, resolve } from "node:path";
import { runtimeDependencies, runtimeDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";
import { createFetchableDevEnvironment } from "./dev.ts";
import { isAbsolute } from "pathe";

export function getEnvRunner(ctx: NitroPluginContext) {
  return (ctx._envRunner ??= new NodeEnvRunner({
    name: "nitro-vite",
    entry: resolve(runtimeDir, "internal/vite/node-runner.mjs"),
    data: { server: true },
  }));
}

export function createNitroEnvironment(
  ctx: NitroPluginContext
): EnvironmentOptions {
  return {
    consumer: "server",
    build: {
      rollupOptions: ctx.bundlerConfig!.rollupConfig as any,
      rolldownOptions: ctx.bundlerConfig!.rolldownConfig,
      minify: ctx.nitro!.options.minify,
      emptyOutDir: false,
      sourcemap: ctx.nitro!.options.sourcemap,
      commonjsOptions: ctx.nitro!.options.commonJS as RollupCommonJSOptions,
    },
    resolve: {
      noExternal: ctx.nitro!.options.dev
        ? [
            /^nitro$/, // i have absolutely no idea why and how it fixes issues!
            new RegExp(`^(${runtimeDependencies.join("|")})$`), // virtual resolutions in vite skip plugin hooks
            ...ctx.bundlerConfig!.base.noExternal,
          ]
        : true, // production build is standalone
      conditions: ctx.nitro!.options.exportConditions,
      externalConditions: ctx.nitro!.options.exportConditions?.filter(
        (c) => !/browser|wasm|module/.test(c)
      ),
    },
    define: {
      // Workaround for tanstack-start (devtools)
      "process.env.NODE_ENV": JSON.stringify(
        ctx.nitro!.options.dev ? "development" : "production"
      ),
    },
    dev: {
      createEnvironment: (envName, envConfig) =>
        createFetchableDevEnvironment(
          envName,
          envConfig,
          getEnvRunner(ctx),
          resolve(runtimeDir, "internal/vite/dev-entry.mjs")
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
      rollupOptions: { input: { index: serviceConfig.entry } },
      minify: ctx.nitro!.options.minify,
      sourcemap: ctx.nitro!.options.sourcemap,
      outDir: join(ctx.nitro!.options.buildDir, "vite/services", name),
      emptyOutDir: true,
    },
    resolve: {
      conditions: ctx.nitro!.options.exportConditions,
      externalConditions: ctx.nitro!.options.exportConditions?.filter(
        (c) => !/browser|wasm|module/.test(c)
      ),
    },
    dev: {
      createEnvironment: (envName, envConfig) =>
        createFetchableDevEnvironment(
          envName,
          envConfig,
          getEnvRunner(ctx),
          tryResolve(serviceConfig.entry)
        ),
    },
  };
}

export function createServiceEnvironments(
  ctx: NitroPluginContext
): Record<string, EnvironmentOptions> {
  return Object.fromEntries(
    Object.entries(ctx.services).map(([name, config]) => [
      name,
      createServiceEnvironment(ctx, name, config),
    ])
  );
}

function tryResolve(id: string) {
  if (/^[~#/\0]/.test(id) || isAbsolute(id)) {
    return id;
  }
  const resolved = resolveModulePath(id, {
    suffixes: ["", "/index"],
    extensions: ["", ".ts", ".mjs", ".cjs", ".js", ".mts", ".cts"],
    try: true,
  });
  return resolved || id;
}
