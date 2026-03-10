import type { EnvironmentOptions, RollupCommonJSOptions } from "vite";
import type { NitroPluginContext, ServiceConfig } from "./types.ts";

import type { RunnerName } from "env-runner";
import { RunnerManager, loadRunner } from "env-runner";
import { join, resolve } from "node:path";
import { runtimeDependencies, runtimeDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";
import { createFetchableDevEnvironment } from "./dev.ts";
import { isAbsolute } from "pathe";

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
        const entry = resolve(runtimeDir, "internal/vite/dev-entry.mjs");
        const env = createFetchableDevEnvironment(envName, envConfig, getEnvRunner(ctx), entry, {
          preventExternalize: isWorkerdRunner,
        });
        ctx._transformRequest = (id) => env.transformRequest(id);
        (ctx._viteEnvs ??= new Map()).set(envName, entry);
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
      createEnvironment: (envName, envConfig) => {
        const entry = tryResolve(serviceConfig.entry);
        (ctx._viteEnvs ??= new Map()).set(envName, entry);
        return createFetchableDevEnvironment(envName, envConfig, getEnvRunner(ctx), entry, {
          preventExternalize: isWorkerdRunner,
        });
      },
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

export async function initEnvRunner(ctx: NitroPluginContext) {
  if (ctx._envRunner) {
    return ctx._envRunner;
  }
  if (!ctx._initPromise) {
    ctx._initPromise = (async () => {
      const manager = new RunnerManager();
      let _retries = 0;
      manager.onClose((_runner, cause) => {
        if (_retries++ < 3) {
          ctx.nitro!.logger.info("Restarting env runner...", cause ? `Cause: ${cause}` : "");
          _loadRunner(ctx, manager);
        } else {
          ctx.nitro!.logger.error(
            "Env runner failed after 3 retries.",
            cause ? `Last cause: ${cause}` : ""
          );
        }
      });
      manager.onReady(() => {
        _retries = 0;
        if (ctx._viteEnvs) {
          for (const [name, entry] of ctx._viteEnvs) {
            manager.sendMessage({
              type: "custom",
              event: "nitro:vite-env",
              data: { name, entry },
            });
          }
        }
      });
      await _loadRunner(ctx, manager);
      ctx._envRunner = manager;
      return manager;
    })();
  }
  return await ctx._initPromise;
}

export function getEnvRunner(ctx: NitroPluginContext) {
  if (!ctx._envRunner) {
    throw new Error("Env runner not initialized. Call initEnvRunner() first.");
  }
  return ctx._envRunner;
}

export async function reloadEnvRunner(ctx: NitroPluginContext) {
  const manager = ctx._envRunner;
  if (!manager) {
    return initEnvRunner(ctx);
  }
  await _loadRunner(ctx, manager);
  return manager;
}

async function _loadRunner(ctx: NitroPluginContext, manager: RunnerManager) {
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
    });
  } else {
    runner = await loadRunner(runnerName, {
      name: "nitro-vite",
      data: { entry },
    });
  }
  await manager.reload(runner);
}

// workerd-based runners (miniflare) cannot handle CJS externals via import(),
// so all dependencies must be processed through Vite's transform pipeline.
function _isWorkerdRunner(ctx: NitroPluginContext): boolean {
  const runnerName =
    ctx.nitro!.options.devServer.runner || process.env.NITRO_DEV_RUNNER || "node-worker";
  return runnerName === "miniflare";
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
