import type {
  CacheOptions,
  CaptureError,
  CapturedErrorContext,
} from "nitropack/types";
import type { $Fetch, NitroFetchRequest } from "./fetch/fetch";

export type H3EventFetch = (
  request: NitroFetchRequest,
  init?: RequestInit
) => Promise<Response>;

export type H3Event$Fetch = $Fetch<unknown, NitroFetchRequest>;

declare module "h3" {
  interface H3Event {
    /** @experimental Calls fetch with same context and request headers */
    fetch: H3EventFetch;
    /** @experimental Calls fetch with same context and request headers */
    $fetch: H3Event$Fetch;
    /** @experimental See https://github.com/nitrojs/nitro/issues/1420 */
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

export type {};
