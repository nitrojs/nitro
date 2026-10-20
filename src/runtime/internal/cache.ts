import { defineHandler, handleCacheHeaders, toResponse, withCacheIsolation } from "h3";
import { FastResponse } from "srvx";
import {
  defineCachedFunction as _defineCachedFunction,
  defineCachedHandler as _defineCachedHandler,
} from "ocache";
import type { CachedFunction, StorageInterface } from "ocache";
import {
  cacheFunctionDefaults,
  cacheHandlerDefaults,
  cacheServerTiming,
  createCacheStorage,
} from "#nitro/virtual/cache";
import { useNitroApp } from "./app.ts";
import { beginOp, endOp, getServerTimingContext } from "./server-timing.ts";

import type { EventHandler, H3Event } from "h3";
import type { CachedFunctionOptions, CachedHandlerOptions } from "nitro/types";

let _cacheStorage: StorageInterface | undefined;

export function cacheStorage(): StorageInterface {
  return (_cacheStorage ??= createCacheStorage());
}

export function defaultOnError(error: unknown): void {
  console.error("[cache]", error);
  useNitroApp().captureError?.(error as Error, { tags: ["cache"] });
}

export function defineCachedFunction<T, ArgsT extends unknown[] = any[]>(
  fn: (...args: ArgsT) => T | Promise<T>,
  opts: CachedFunctionOptions<T, ArgsT> = {}
): CachedFunction<T, ArgsT> {
  return _defineCachedFunction(fn, {
    storage: cacheStorage,
    group: "nitro/functions",
    onError: defaultOnError,
    ...cacheFunctionDefaults,
    ...definedOptions(opts),
  });
}

export function defineCachedHandler(
  handler: EventHandler,
  opts: CachedHandlerOptions = {}
): EventHandler {
  const options = { ...cacheHandlerDefaults, ...definedOptions(opts) };
  const statusHeader = resolveStatusHeader(options.cacheStatusHeader ?? true);
  const ocacheHandler = withCacheIsolation(
    _defineCachedHandler(handler as any, {
      storage: cacheStorage,
      group: "nitro/handlers",
      onError: defaultOnError,
      toResponse: async (value, event) =>
        detachServerTiming(await toResponse(value, event as H3Event), event as H3Event),
      createResponse: (body, init) => new FastResponse(body as BodyInit, init),
      handleCacheHeaders: (event, conditions) => handleCacheHeaders(event as H3Event, conditions),
      ...options,
      // Resolved here (instead of relying on ocache's default) as server timing reads it back.
      cacheStatusHeader: statusHeader || false,
    }) as EventHandler
  );
  if (!cacheServerTiming) {
    return defineHandler((event) => ocacheHandler(event as any));
  }
  return defineHandler(async (event) => {
    const metric = beginOp(getServerTimingContext(event), "cache");
    if (!metric) {
      return ocacheHandler(event as any);
    }
    let status: string | undefined;
    try {
      const res = (await ocacheHandler(event as any)) as Response;
      if (statusHeader) {
        // Bypassed responses carry no status from ocache, only the handler's own header (if any).
        const value = res.headers.get(statusHeader)?.toLowerCase();
        status = value && cacheStatuses.has(value) ? value : "bypass";
      }
      return res;
    } finally {
      endOp(metric, status);
    }
  });
}

const cacheStatuses = /* @__PURE__ */ new Set(["hit", "miss", "stale", "revalidated"]);

/**
 * `Server-Timing` describes the request that filled the cache entry: keep it out of the entry
 * (it would be replayed on every hit) and stage it on the live response instead.
 */
function detachServerTiming(res: Response, event: H3Event): Response {
  const timing = res.headers.get("server-timing");
  if (!timing) {
    return res;
  }
  // h3 merges staged headers into returned responses (`errHeaders` for error statuses).
  (res.status >= 400 ? event.res.errHeaders : event.res.headers).append("server-timing", timing);
  const headers = new Headers(res.headers);
  headers.delete("server-timing");
  return new FastResponse(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Response header ocache writes the cache status to (`cacheStatusHeader`). */
function resolveStatusHeader(option: boolean | string): string | undefined {
  return option === true ? "x-cache" : option ? option.toLowerCase() : undefined;
}

function definedOptions<T extends object>(opts: T): T {
  const defined = {} as T;
  for (const key in opts) {
    if (opts[key] !== undefined) {
      defined[key] = opts[key];
    }
  }
  return defined;
}
