import { TSConfig } from "pkg-types";
import type { NitroConfig } from "./config";
import type { Nitro, NitroTypes } from "./nitro";
import type { PrerenderRoute } from "./prerender";
import type { RollupConfig } from "./rollup";

type HookResult = void | Promise<void>;

export interface NitroHooks {
  "prepare:types": (options: {
    declarations: string[];
    tsConfig: TSConfig | undefined;
  }) => HookResult;
  "types:extend": (types: NitroTypes) => HookResult;
  "rollup:before": (nitro: Nitro, config: RollupConfig) => HookResult;
  compiled: (nitro: Nitro) => HookResult;
  "dev:reload": () => HookResult;
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
