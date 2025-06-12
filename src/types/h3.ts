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
  interface H3Event {
    /** @experimental Calls fetch with same context and request headers */
    fetch?: H3EventFetch;
    /** @experimental Calls fetch with same context and request headers */
    $fetch?: H3Event$Fetch;
    /** @experimental */
    captureError?: CaptureError;
  }

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
