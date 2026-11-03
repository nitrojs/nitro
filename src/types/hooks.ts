import type { EnvRunnerData, EnvRunnerPluginOption } from "env-runner";
import type { NitroConfig } from "./config.ts";
import type { Nitro } from "./nitro.ts";
import type { PrerenderRoute } from "./prerender.ts";
import type { NitroBuildConfig, RollupConfig } from "./build.ts";

type HookResult = void | Promise<void>;

export interface NitroHooks {
  "build:before": (nitro: Nitro) => HookResult;
  /**
   * Called after the bundler config is resolved, right before bundling. Last chance to modify it.
   *
   * The config is passed as `{ builder, rollup }`, `{ builder, rolldown }` or `{ builder, bun }`,
   * depending on the builder and bundler in use.
   */
  "build:config": (nitro: Nitro, config: NitroBuildConfig) => HookResult;
  "vite:compile:before": (nitro: Nitro) => HookResult;
  compiled: (nitro: Nitro) => HookResult;
  "dev:reload": (payload?: {
    entry?: string;
    workerData?: EnvRunnerData;
    /** Host-side env-runner plugins for the dev runner. */
    plugins?: EnvRunnerPluginOption[];
  }) => HookResult;
  "dev:start": () => HookResult;
  "dev:error": (cause?: unknown) => HookResult;
  /** Called when the Nitro config is hot-reloaded to rebuild the server. */
  "build:reload": () => HookResult;
  restart: () => HookResult;
  close: () => HookResult;
  // Prerender
  "prerender:routes": (routes: Set<string>) => HookResult;
  "prerender:config": (config: NitroConfig) => HookResult;
  "prerender:init": (prerenderer: Nitro) => HookResult;
  "prerender:generate": (route: PrerenderRoute, nitro: Nitro) => HookResult;
  "prerender:route": (route: PrerenderRoute) => HookResult;
  "prerender:done": (result: {
    prerenderedRoutes: PrerenderRoute[];
    failedRoutes: PrerenderRoute[];
  }) => HookResult;

  /** @deprecated Use `build:config` (the config is passed as `{ rollup }` or `{ rolldown }`). */
  "rollup:before": (nitro: Nitro, config: RollupConfig) => HookResult;
  /** @deprecated Use `build:reload`. */
  "rollup:reload": () => HookResult;
}
