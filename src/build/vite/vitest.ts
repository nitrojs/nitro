import type { UserConfig, Plugin as VitePlugin } from "vite";
import { resolve } from "pathe";
import { runtimeDir } from "nitro/meta";

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
export function nitroVitest(): VitePlugin {
  const envPath = resolve(runtimeDir, "internal/vite/vitest-env.mjs");
  return {
    name: "nitro:vitest",
    apply: (_config, configEnv) => configEnv.command === "serve",

    config(userConfig) {
      if (!isVitest(userConfig)) {
        return;
      }
      const environment = (userConfig as { test?: { environment?: string } }).test?.environment;
      if (!environment || environment === "nitro") {
        return { test: { environment: envPath } } as UserConfig;
      }
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
