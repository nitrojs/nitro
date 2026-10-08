import type { UserConfig, Plugin as VitePlugin } from "vite";
import type { NitroPluginContext } from "./types.ts";
import { resolve } from "pathe";
import { runtimeDir } from "nitro/meta";
import { setupVitestWatch } from "./_vitest-watch.ts";

// https://vitest.dev/guide/environment#custom-environment

/**
 * Vitest creates its internal `__vitest__` environment before any plugin `config` hook runs.
 */
export function isVitest(config: UserConfig): boolean {
  return !!config.environments?.__vitest__;
}

/**
 * Runs Vitest test files in the `nitro` Vite environment by default, so they resolve `nitro/*`
 * runtime imports, virtual modules and aliases the same way server code does.
 *
 * The environment is set by path, since Vitest resolves named environments as packages before
 * loading the config plugins. `// @vitest-environment nitro` resolves through `resolveId`.
 */
export function nitroVitest(ctx: NitroPluginContext): VitePlugin {
  const envPath = resolve(runtimeDir, "internal/vite/vitest-env.mjs");
  const setupPath = resolve(runtimeDir, "internal/vite/vitest-setup.mjs");
  return {
    name: "nitro:vitest",
    apply: (_config, configEnv) => configEnv.command === "serve",

    config(userConfig) {
      if (!isVitest(userConfig)) {
        return;
      }
      const { environment, pool } =
        (userConfig as { test?: { environment?: string; pool?: string } }).test || {};
      // vm pools only run environments that provide `setupVM`
      const isVmPool = pool === "vmThreads" || pool === "vmForks";
      return {
        test: {
          environment:
            environment === "nitro" || (!environment && !isVmPool) ? envPath : environment,
          setupFiles: [setupPath],
        },
      } as UserConfig;
    },

    configureVitest(context) {
      setupVitestWatch(ctx, context);
    },

    // Setup files run in every test environment, but only the nitro one has an app
    load: {
      filter: { id: /vitest-setup\.mjs$/ },
      handler(id) {
        if (id === setupPath && this.environment.name !== "nitro") {
          return "export {};";
        }
      },
    },

    resolveId: {
      filter: { id: /^vitest-environment-nitro$/ },
      handler(id) {
        if (id === "vitest-environment-nitro") {
          return envPath;
        }
      },
    },
  };
}
