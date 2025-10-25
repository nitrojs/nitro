import type { H3Event as _H3Event } from "h3";
import type { CacheOptions, CapturedErrorContext } from "./runtime";
import type { Base$Fetch, NitroFetchRequest } from "./fetch/fetch";
import type { NitroRuntimeConfig } from "./config";
import type { MatchedRouteRules } from "./route-rules";

export type H3EventFetch = (
  request: NitroFetchRequest,
  init?: RequestInit
) => Promise<Response>;

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

export type {};
