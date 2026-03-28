import { defineHandler, handleCacheHeaders, toResponse } from "h3";
import { FastResponse } from "srvx";
import {
  defineCachedFunction as _defineCachedFunction,
  defineCachedHandler as _defineCachedHandler,
  setStorage,
} from "ocache";
import { useNitroApp } from "./app.ts";
import { useStorage } from "./storage.ts";

import type { EventHandler, H3Event } from "h3";
import type { CacheOptions, CachedEventHandlerOptions } from "nitro/types";

let _storageReady = false;

/**
 * Sanitize a cache group or name so it is safe for filesystem-based storage
 * drivers (fs, fs-lite). Unstorage maps ":" to "/" on disk, so any "/" already
 * present in the value would create unexpected directory nesting and cause
 * ENOTDIR errors when a path is both a file and a prefix of another path.
 */
function sanitizeCacheKey(value: string | undefined): string | undefined {
  return value?.replace(/\//g, "_");
}

function ensureStorage() {
  if (_storageReady) {
    return;
  }
  _storageReady = true;
  const storage = useStorage();
  setStorage({
    get: (key) => storage.getItem(key) as any,
    set: (key, value, opts) =>
      storage.setItem(key, value as any, opts?.ttl ? { ttl: opts.ttl } : undefined),
  });
}

function defaultOnError(error: unknown) {
  console.error("[cache]", error);
  useNitroApp().captureError?.(error as Error, { tags: ["cache"] });
}

export function defineCachedFunction<T, ArgsT extends unknown[] = any[]>(
  fn: (...args: ArgsT) => T | Promise<T>,
  opts: CacheOptions<T, ArgsT> = {}
): (...args: ArgsT) => Promise<T> {
  ensureStorage();
  return _defineCachedFunction(fn, {
    group: "nitro-functions",
    onError: defaultOnError,
    ...opts,
    name: sanitizeCacheKey(opts.name),
  });
}

export function defineCachedHandler(
  handler: EventHandler,
  opts: CachedEventHandlerOptions = {}
): EventHandler {
  ensureStorage();
  const ocacheHandler = _defineCachedHandler(handler as any, {
    group: "nitro-handlers",
    onError: defaultOnError,
    toResponse: (value, event) => toResponse(value, event as H3Event),
    createResponse: (body, init) => new FastResponse(body, init),
    handleCacheHeaders: (event, conditions) => handleCacheHeaders(event as H3Event, conditions),
    ...opts,
    name: sanitizeCacheKey(opts.name),
  });
  return defineHandler((event) => ocacheHandler(event as any));
}
