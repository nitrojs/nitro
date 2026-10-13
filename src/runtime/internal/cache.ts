import { defineHandler, handleCacheHeaders, toResponse } from "h3";
import { FastResponse } from "srvx";
import {
  defineCachedFunction as _defineCachedFunction,
  defineCachedHandler as _defineCachedHandler,
} from "ocache";
import type { CachedFunction, StorageInterface } from "ocache";
import {
  cacheFunctionDefaults,
  cacheHandlerDefaults,
  createCacheStorage,
} from "#nitro/virtual/cache";
import { useNitroApp } from "./app.ts";

import type { EventHandler, H3Event } from "h3";
import type { CachedFunctionOptions, CachedHandlerOptions } from "nitro/types";

let _cacheStorage: StorageInterface | undefined;

function cacheStorage(): StorageInterface {
  return (_cacheStorage ??= createCacheStorage());
}

function defaultOnError(error: unknown) {
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
  const ocacheHandler = _defineCachedHandler(handler as any, {
    storage: cacheStorage,
    group: "nitro/handlers",
    onError: defaultOnError,
    toResponse: (value, event) => toResponse(value, event as H3Event),
    createResponse: (body, init) => new FastResponse(body as BodyInit, init),
    handleCacheHeaders: (event, conditions) => handleCacheHeaders(event as H3Event, conditions),
    ...cacheHandlerDefaults,
    ...definedOptions(opts),
  });
  return defineHandler((event) => ocacheHandler(event as any));
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
