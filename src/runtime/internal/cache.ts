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
import type { RuleHandler } from "h3/rules";
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
  const ocacheHandler = withCacheIsolation(
    _defineCachedHandler(handler as any, {
      storage: cacheStorage,
      group: "nitro/handlers",
      onError: defaultOnError,
      toResponse: (value, event) => toResponse(value, event as H3Event),
      createResponse: (body, init) => new FastResponse(body as BodyInit, init),
      handleCacheHeaders: (event, conditions) => handleCacheHeaders(event as H3Event, conditions),
      ...cacheHandlerDefaults,
      ...definedOptions(opts),
    }) as EventHandler
  );
  const cachedHandler = (event: H3Event) => ocacheHandler(event as any);
  return defineHandler(
    cacheServerTiming ? withCacheServerTiming(cachedHandler, opts.cacheStatusHeader) : cachedHandler
  );
}

/** Records the `cache` server timing metric around the `cache` route rule. */
export function withCacheRuleServerTiming(rule: RuleHandler<"cache">): RuleHandler<"cache"> {
  if (!cacheServerTiming) {
    return rule;
  }
  return {
    ...rule,
    handler: (matched) =>
      withCacheServerTiming(rule.handler(matched), matched.options.cacheStatusHeader),
  };
}

/** Records the duration and cache status of a cached handler as the `cache` server timing metric. */
function withCacheServerTiming<T extends (event: H3Event, ...args: any[]) => unknown>(
  handler: T,
  cacheStatusHeader: boolean | string | undefined
): T {
  const statusHeader = resolveStatusHeader(
    cacheStatusHeader ?? cacheHandlerDefaults.cacheStatusHeader ?? true
  );
  return (async (event: H3Event, ...args: unknown[]) => {
    const metric = beginOp(getServerTimingContext(event), "cache");
    if (!metric) {
      return handler(event, ...args);
    }
    let status: string | undefined;
    try {
      const res = await handler(event, ...args);
      if (statusHeader) {
        // Bypassed responses carry no status from ocache, only the handler's own header (if any).
        const value =
          res instanceof Response ? res.headers.get(statusHeader)?.toLowerCase() : undefined;
        status = value && cacheStatuses.has(value) ? value : "bypass";
      }
      return res;
    } finally {
      endOp(metric, status);
    }
  }) as T;
}

const cacheStatuses = /* @__PURE__ */ new Set(["hit", "miss", "stale", "revalidated"]);

/** Response header ocache writes the cache status to (same resolution as ocache's `cacheStatusHeader`). */
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
