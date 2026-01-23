import type { EnvRunnerData } from "../runner/node.ts";
import type { NitroConfig } from "./config.ts";
import type { Nitro, NitroTypes } from "./nitro.ts";
import type { PrerenderRoute } from "./prerender.ts";
import type { RollupConfig } from "./build.ts";

type HookResult = void | Promise<void>;

export interface NitroHooks {
  "types:extend": (types: NitroTypes) => HookResult;
  "build:before": (nitro: Nitro) => HookResult;
  "rollup:before": (nitro: Nitro, config: RollupConfig) => HookResult;
  compiled: (nitro: Nitro) => HookResult;
  "dev:reload": (payload?: { entry?: string; workerData?: EnvRunnerData }) => HookResult;
  "dev:start": () => HookResult;
  "dev:error": (cause?: unknown) => HookResult;
  "rollup:reload": () => HookResult;
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
}
