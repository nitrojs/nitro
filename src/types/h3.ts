import { type H3Event as _H3Event } from "h3";
import type {
  CacheOptions,
  CaptureError,
  CapturedErrorContext,
} from "./runtime";
import type { Base$Fetch, NitroFetchRequest } from "./fetch/fetch";
import type { NitroRuntimeConfig } from "./config";

export type H3EventFetch = (
  request: NitroFetchRequest,
  init?: RequestInit
) => Promise<Response>;

export type H3Event$Fetch = Base$Fetch<unknown, NitroFetchRequest>;

declare module "h3" {
  interface H3EventContext {
    nitro?: {
      _waitUntilPromises?: Promise<unknown>[];
      /** @experimental */
      errors: { error?: Error; context: CapturedErrorContext }[];
      runtimeConfig?: NitroRuntimeConfig;
    };

    cache?: {
      options: CacheOptions;
    };
  }
}

export type {};
