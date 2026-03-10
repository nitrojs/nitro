import type { EnvironmentOptions, RollupCommonJSOptions } from "vite";
import type { NitroPluginContext, ServiceConfig } from "./types.ts";

import type { RunnerName } from "env-runner";
import { loadRunner } from "env-runner";
import { join, resolve } from "node:path";
import { runtimeDependencies, runtimeDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";
import { createFetchableDevEnvironment } from "./dev.ts";
import { isAbsolute } from "pathe";

let _initPromise: Promise<NitroPluginContext["_envRunner"]> | undefined;

export async function initEnvRunner(ctx: NitroPluginContext) {
  if (ctx._envRunner) {
    return ctx._envRunner;
  }
  if (!_initPromise) {
    _initPromise = (async () => {
      const runnerName = (ctx.nitro!.options.devServer.runner ||
        process.env.NITRO_DEV_RUNNER ||
        "node-worker") as RunnerName;
      const entry = resolve(runtimeDir, "internal/vite/dev-worker.mjs");
      let runner;
      if (runnerName === "miniflare") {
        const { MiniflareEnvRunner } = await import("env-runner/runners/miniflare");
        runner = new MiniflareEnvRunner({
          name: "nitro-vite",
          data: { entry },
          // transformRequest: async (id) => {},
        });
      } else {
        runner = await loadRunner(runnerName, {
          name: "nitro-vite",
          data: { entry },
        });
      }
      await runner.waitForReady();
      ctx._envRunner = runner;
      return runner;
    })();
  }
  return await _initPromise;
}

export function getEnvRunner(ctx: NitroPluginContext) {
  if (!ctx._envRunner) {
    throw new Error("Env runner not initialized. Call initEnvRunner() first.");
  }
  return ctx._envRunner;
}

// workerd-based runners (miniflare) cannot handle CJS externals via import(),
// so all dependencies must be processed through Vite's transform pipeline.
function _isWorkerdRunner(ctx: NitroPluginContext): boolean {
  const runnerName =
    ctx.nitro!.options.devServer.runner || process.env.NITRO_DEV_RUNNER || "node-worker";
  return runnerName === "miniflare";
}

export function createNitroEnvironment(ctx: NitroPluginContext): EnvironmentOptions {
  const isWorkerdRunner = _isWorkerdRunner(ctx);
  return {
    consumer: "server",
    build: {
      rollupOptions: ctx.bundlerConfig!.rollupConfig as any,
      rolldownOptions: ctx.bundlerConfig!.rolldownConfig,
      minify: ctx.nitro!.options.minify,
      emptyOutDir: false,
      sourcemap: ctx.nitro!.options.sourcemap,
      commonjsOptions: ctx.nitro!.options.commonJS as RollupCommonJSOptions,
      copyPublicDir: false,
    },
    resolve: {
      noExternal: ctx.nitro!.options.dev
        ? isWorkerdRunner
          ? true
          : [
              /^nitro$/, // i have absolutely no idea why and how it fixes issues!
              new RegExp(`^(${runtimeDependencies.join("|")})$`), // virtual resolutions in vite skip plugin hooks
              ...ctx.bundlerConfig!.base.noExternal,
            ]
        : true, // production build is standalone
      // workerd cannot handle CJS modules, so we must avoid the "node" export
      // condition which often resolves to CJS entries.
      conditions: isWorkerdRunner
        ? ["workerd", "worker", ...ctx.nitro!.options.exportConditions!.filter((c) => c !== "node")]
        : ctx.nitro!.options.exportConditions,
      externalConditions: ctx.nitro!.options.exportConditions?.filter(
        (c) => !/browser|wasm|module/.test(c)
      ),
    },
    define: {
      // Workaround for tanstack-start (devtools)
      "process.env.NODE_ENV": JSON.stringify(ctx.nitro!.options.dev ? "development" : "production"),
    },
    dev: {
      createEnvironment: (envName, envConfig) => {
        const env = createFetchableDevEnvironment(
          envName,
          envConfig,
          getEnvRunner(ctx),
          resolve(runtimeDir, "internal/vite/dev-entry.mjs"),
          { preventExternalize: isWorkerdRunner }
        );
        ctx._transformRequest = (id) => env.transformRequest(id);
        return env;
      },
    },
  };
}

export function createServiceEnvironment(
  ctx: NitroPluginContext,
  name: string,
  serviceConfig: ServiceConfig
): EnvironmentOptions {
  const isWorkerdRunner = _isWorkerdRunner(ctx);
  return {
    consumer: "server",
    build: {
      rollupOptions: { input: { index: serviceConfig.entry } },
      minify: ctx.nitro!.options.minify,
      sourcemap: ctx.nitro!.options.sourcemap,
      outDir: join(ctx.nitro!.options.buildDir, "vite/services", name),
      emptyOutDir: true,
      copyPublicDir: false,
    },
    resolve: {
      ...(isWorkerdRunner ? { noExternal: true } : {}),
      conditions: isWorkerdRunner
        ? ["workerd", "worker", ...ctx.nitro!.options.exportConditions!.filter((c) => c !== "node")]
        : ctx.nitro!.options.exportConditions,
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
          tryResolve(serviceConfig.entry),
          { preventExternalize: isWorkerdRunner }
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
