import type { H3Event as _H3Event } from "h3";
import type { CacheOptions, CapturedErrorContext } from "./runtime/index.ts";
import type { Base$Fetch, NitroFetchRequest } from "./fetch/fetch.ts";
import type { NitroRuntimeConfig } from "./config.ts";
import type { MatchedRouteRules } from "./route-rules.ts";

export type H3EventFetch = (request: NitroFetchRequest, init?: RequestInit) => Promise<Response>;

export type H3Event$Fetch = Base$Fetch<unknown, NitroFetchRequest>;

declare module "srvx" {
  interface ServerRequestContext {
    routeRules?: MatchedRouteRules;
    nitro?: {
      runtimeConfig?: NitroRuntimeConfig;
      errors?: { error?: Error; context: CapturedErrorContext }[];
    };
    cache?: {
      options?: CacheOptions;
    };
  }
}

// eslint-disable-next-line unicorn/require-module-specifiers
export type {};
