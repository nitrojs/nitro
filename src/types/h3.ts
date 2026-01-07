import type {
  CacheOptions,
  CaptureError,
  CapturedErrorContext,
} from "nitropack/types";
import type { Base$Fetch, NitroFetchRequest } from "./fetch/fetch";

export type H3EventFetch = (
  request: NitroFetchRequest,
  init?: RequestInit
) => Promise<Response>;

export type H3Event$Fetch = Base$Fetch<unknown, NitroFetchRequest>;

declare module "h3" {
  interface H3Event {
    /** @experimental Calls fetch with same context and request headers */
    fetch: H3EventFetch;
    /** @experimental Calls fetch with same context and request headers */
    $fetch: H3Event$Fetch;
    waitUntil: (promise: Promise<unknown>) => void;
    /** @experimental */
    captureError: CaptureError;
  }
  interface H3Context {
    nitro: {
      _waitUntilPromises?: Promise<unknown>[];
      /** @experimental */
      errors: { error?: Error; context: CapturedErrorContext }[];
    };

    cache: {
      options: CacheOptions;
    };
  }
}

// eslint-disable-next-line unicorn/require-module-specifiers
export type {};
