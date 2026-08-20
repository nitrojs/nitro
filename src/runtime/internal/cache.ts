import { defineHandler, handleCacheHeaders, toResponse } from "h3";
import { FastResponse } from "srvx";
import {
  defineCachedFunction as _defineCachedFunction,
  defineCachedHandler as _defineCachedHandler,
} from "ocache";
import type { CachedFunction, StorageInterface } from "ocache";
import { useNitroApp } from "./app.ts";
import { useStorage } from "./storage.ts";

import type { EventHandler, H3Event } from "h3";
import type { CacheOptions, CachedEventHandlerOptions } from "nitro/types";

let _cacheStorage: StorageInterface | undefined;

function cacheStorage(): StorageInterface {
  if (!_cacheStorage) {
    const storage = useStorage();
    _cacheStorage = {
      get: (key) => storage.getItem(key) as any,
      set: (key, value, opts) =>
        storage.setItem(key, value as any, opts?.ttl ? { ttl: opts.ttl } : undefined),
    };
  }
  return _cacheStorage;
}

function defaultOnError(error: unknown) {
  console.error("[cache]", error);
  useNitroApp().captureError?.(error as Error, { tags: ["cache"] });
}

export function defineCachedFunction<T, ArgsT extends unknown[] = any[]>(
  fn: (...args: ArgsT) => T | Promise<T>,
  opts: CacheOptions<T, ArgsT> = {}
): CachedFunction<T, ArgsT> {
  return _defineCachedFunction(fn, {
    storage: cacheStorage,
    group: "nitro/functions",
    onError: defaultOnError,
    ...opts,
  });
}

export function defineCachedHandler(
  handler: EventHandler,
  opts: CachedEventHandlerOptions = {}
): EventHandler {
  const ocacheHandler = _defineCachedHandler(handler as any, {
    storage: cacheStorage,
    group: "nitro/handlers",
    onError: defaultOnError,
    toResponse: (value, event) => toResponse(value, event as H3Event),
    createResponse: (body, init) => new FastResponse(body as BodyInit, init),
    handleCacheHeaders: (event, conditions) => handleCacheHeaders(event as H3Event, conditions),
    ...opts,
  });
  return defineHandler((event) => ocacheHandler(event as any));
}
